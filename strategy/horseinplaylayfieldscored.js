'use strict';

const config = require('../config/local'),
    logger = require('../lib/logger'),
    promise = require('bluebird'),
    _ = require('lodash'),
    betfair = require('betfair'),
    account = require('../lib/account'),
    bfEvent = require('../lib/bfevent'),
    market = require('../lib/market'),
    raceStatus = require('../lib/racestatus'),
    utils = require('../lib/utils'),
    betting = require('../lib/betting'),
    strategyConfig = config.strategies.horseinplaylayfieldscored;

module.exports = {

    init: function(session) {
        const _this = this;

        return promise.coroutine(function*() {
            // Run forever
            while (1 !== 2) {
                // Call once per day
                yield _this.processTodaysRaces(session);
            }
        })();
    },

    tradeMarket: function(session, currentMarket, marketBook) {
        const _this = this;

        return promise.coroutine(function*() {
            logger.log(`Trading market ${currentMarket.description}`, 'info');

            const activeRunners = marketBook.numberOfActiveRunners,
                totalMatched = marketBook.totalMatched,
                status = marketBook.status,
                favouritePrice = utils.getMinPriceFromRunners(marketBook.runners),
                raceScore = _this.getRaceScore(currentMarket, marketBook);

            if (raceScore > (strategyConfig.layPrice + strategyConfig.scoreTargetOffset)) {
                // Check favourite odds are well above our lay price
                if (favouritePrice > strategyConfig.layPrice + 0.08) {
                    const accountFunds = yield account.getAccountFunds(session);

                    // Check we have enough money
                    if (accountFunds.result.availableToBetBalance > 2) {

                        let maxLiability = (accountFunds.result.availableToBetBalance * (strategyConfig.liabilityPercent / 100)).toFixed(2),
                            stake = (maxLiability / (strategyConfig.layPrice - 1)).toFixed(2);

                        // Check for min bet size
                        if (stake < 2.00) {
                            stake = 2.00;
                            maxLiability = (stake * (strategyConfig.layPrice - 1)).toFixed(2);
                        }

                        logger.log(`Account funds £${accountFunds.result.availableToBetBalance.toFixed(2)} Max liability per trade £${maxLiability}`, 'info');

                        if (strategyConfig.placeOrders) {
                            logger.log(`${currentMarket.description} - Laying the field of ${activeRunners} runners at ${strategyConfig.layPrice} for £${stake}. Race score: ${raceScore.toFixed(4)}`, 'info');
                            _this.placeLayOrders(session, currentMarket, marketBook.runners, strategyConfig.layPrice, stake);
                        } else {
                            logger.log(`Not laying the field. Not configured to place orders`, 'info');
                        }

                    } else {
                        logger.log(`Not laying the field. Account balance ${accountFunds.result.availableToBetBalance.toFixed(2)}`, 'info');
                    }
                } else {
                    logger.log(`Not laying the field. Favourite price ${favouritePrice}`, 'info');
                }
            } else {
                logger.log(`Not laying the field. Race score: ${raceScore.toFixed(4)}. Required score: ${(strategyConfig.layPrice + strategyConfig.scoreTargetOffset).toFixed(4)}`, 'info');
            }

            return;
        })();
    },

    getRaceScore: function(currentMarket, race) {
        const theDate = new Date();

        const runnerScore = _.find(strategyConfig.runnerScores, {
            runners: race.numberOfActiveRunners
        });

        const distanceScore = _.find(strategyConfig.distanceScores, {
            distance: currentMarket.marketName.substr(0, currentMarket.marketName.indexOf(' '))
        });

        const venueScore = _.find(strategyConfig.venueScores, {
            venue: currentMarket.event.venue.replace(/'/g, "")
        });

        const dayScore = _.find(strategyConfig.dayScores, {
            day: theDate.getDay()
        });

        let raceClassScore,
            raceClass;

        raceClassScore = _.find(strategyConfig.raceClassScores, {
            race_class: currentMarket.marketName.substr(currentMarket.marketName.indexOf(' ') + 1).replace(/'/g, "")
        });

        const hourScore = _.find(strategyConfig.hourScores, {
            hour: theDate.getHours()
        });

        let totalScore = 0;

        if (raceClassScore) {
            totalScore = ((distanceScore.matches + venueScore.matches + raceClassScore.matches) / 3.00);
        } else {
            totalScore = ((distanceScore.matches + venueScore.matches) / 2.00);
        }

        return totalScore;
    },

    processTodaysRaces: function(session) {
        const _this = this;

        return promise.coroutine(function*() {
            let startDate = utils.dateOnly(new Date()),
                meetings,
                eventIds;

            logger.log(`Trading Races on ${utils.dateFormatLong(startDate)} using ${config.strategy} strategy`, 'info');

            // Get current account funds
            const accountFunds = yield account.getAccountFunds(session);

            if (!accountFunds.result) {
                logger.log(`Unable to get account funds, trying to process todays races again ...`, 'info');

                // Wait for configured period
                yield utils.sleep(strategyConfig.eventStatusRefreshMs);

                return;
            }

            let maxLiability = (accountFunds.result.availableToBetBalance * (strategyConfig.liabilityPercent / 100)).toFixed(2),
                stake = (maxLiability / (strategyConfig.layPrice - 1)).toFixed(2);

            // Check for min bet size
            if (stake < 2.00) {
                stake = 2.00;
                maxLiability = (stake * (strategyConfig.layPrice - 1)).toFixed(2);
            }

            if (maxLiability > accountFunds.result.availableToBetBalance) {
                maxLiability = 0;
            }

            logger.log(`Account funds £${accountFunds.result.availableToBetBalance.toFixed(2)} Max liability per trade £${maxLiability}`, 'info');

            // Hang around here until 11:00
            let currentHour = new Date().getHours();
            while (currentHour < 11) {
                // Call into API to keep session open
                const accountFunds = yield account.getAccountFunds(session);

                currentHour = new Date().getHours();

                // Wait for 10 mins
                yield utils.sleep(600000);
            }

            // Get today's horse racing meetings
            meetings = yield bfEvent.todaysHorseEvents(session);

            // Grab the horse racing event ids into array
            eventIds = _.map(meetings.result, 'event.id');

            // Get all win markets for horse events
            const races = yield market.todaysHorseWinMarkets(session);

            // Loop until the end of the current day - then start all over again
            while (utils.dateOnly(new Date()).getDate() === startDate.getDate()) {
                const currentHour = new Date().getHours();

                // Get live race status for horse events
                if (eventIds.length > 0 && currentHour >= 11 && currentHour <= 22) {
                    const currentRaceStatus = yield raceStatus.currentRaceStatus(session, eventIds);

                    if (currentRaceStatus && currentRaceStatus.result) {
                        for (let meeting of currentRaceStatus.result) {
                            // Check if the race status has changed and store
                            _this.processRaceStatus(session, races.result, meeting);
                        }
                    } else {
                        logger.log(`Unable to get race statii, trying to process todays races again ...`, 'info');

                        // Wait for configured period
                        yield utils.sleep(strategyConfig.eventStatusRefreshMs);

                        return;
                    }
                }

                // Wait for configured period
                yield utils.sleep(strategyConfig.eventStatusRefreshMs);
            }

        })();
    },

    processRaceStatus: function(session, races, meeting) {
        if (meeting.responseCode === 'NO_LIVE_DATA_AVAILABLE') {
            const event = utils.getEventFromEventId(races, meeting.meetingId).event;
            logger.log(`No live data available for event ${event.name} at ${event.venue}`, 'silly');
        } else {

            let currentMarket = utils.getMarketFromRaceId(races, meeting.raceId);

            if (currentMarket && (currentMarket.raceStatus !== meeting.raceStatus)) {
                // Race status has changed
                let level = 'debug';

                if (!currentMarket.raceStatus) {
                    level = 'silly';
                }

                logger.log(`Race Status change for ${currentMarket.description}, ${currentMarket.raceStatus || 'None'} to ${meeting.raceStatus}`, level);

                // Set the current race status on the market
                currentMarket.raceStatus = meeting.raceStatus;

                switch (currentMarket.raceStatus) {
                    case 'ATTHEPOST':
                        this.atThePost(session, currentMarket);
                        break;
                    case 'OFF':
                        this.off(session, currentMarket);
                        break;
                    case 'FINISHED':
                        this.finished(session, currentMarket);
                        break;
                    case 'FALSESTART':
                        this.falseStart(session, currentMarket);
                        break;
                }
            }
        }

        return;
    },

    atThePost: function(session, currentMarket) {
        const _this = this;
        logger.log(`${currentMarket.description} - At The Post`, 'info');

        return promise.coroutine(function*() {
            const marketBook = yield market.listMarketBook(session, [currentMarket.marketId]);

            if (marketBook.result) {
                _this.tradeMarket(session, currentMarket, marketBook.result[0]);
            } else {
                logger.log('Unable to get market book', 'error');
                console.log(marketBook);
            }

            return;
        })();
    },

    off: function(session, currentMarket) {
        logger.log(`${currentMarket.description} - Off`, 'info');
        return;
    },

    finished: function(session, currentMarket) {
        logger.log(`${currentMarket.description} - Finished`, 'info');
        return;
    },

    falseStart: function(session, currentMarket) {
        logger.log(`${currentMarket.description} - False Start`, 'info');
        return;
    },

    placeLayOrders: function(session, currentMarket, runners, price, stake) {
        const _this = this;

        return promise.coroutine(function*() {
            let bets = [];

            logger.log(`${currentMarket.description} - Placing lay orders`, 'debug');

            for (let runner of runners) {
                if (runner.status === 'ACTIVE' && runner.lastPriceTraded >= price && !runner.orders) {
                    // Runner is active, trading above the price we want to lay and we haven't already placed order on it
                    logger.log(`Laying runner ${runner.selectionId} at ${price} for £${stake}`, 'debug');
                    bets.push({
                        orderType: 'LIMIT',
                        selectionId: runner.selectionId,
                        side: 'LAY',
                        limitOrder: {
                            price: price,
                            size: stake,
                            persistenceType: 'PERSIST'
                        }
                    });
                }
            }

            const placeResult = yield betting.placeOrder(session, currentMarket.marketId, bets);

            return placeResult;
        })();
    }
};