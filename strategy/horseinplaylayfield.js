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
    strategyConfig = config.strategies.horseinplaylayfield;

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
                favouritePrice = utils.getMinPriceFromRunners(marketBook.runners);

            // Check favourite odds are well above our lay price
            if (favouritePrice > strategyConfig.layPrice + 0.1) {
                const accountFunds = yield account.getAccountFunds(session);

                // Check we have enough money
                if (accountFunds.result.availableToBetBalance > 2) {

                    // Check the number of runners
                    if (strategyConfig.excludeRunners.indexOf(activeRunners) === -1) {
                        let maxLiability = (accountFunds.result.availableToBetBalance * (strategyConfig.liabilityPercent / 100)).toFixed(2),
                            stake = (maxLiability / (strategyConfig.layPrice - 1)).toFixed(2);

                        // Check for min bet size
                        if (stake < 2.00) {
                            stake = 2.00;
                            maxLiability = (stake * (layPrice - 1)).toFixed(2);
                        }

                        if (strategyConfig.placeOrders) {
                            logger.log(`${currentMarket.description} - Laying the field of ${activeRunners} runners at ${strategyConfig.layPrice} for £${stake}`, 'info');
                            _this.placeLayOrders(session, currentMarket, marketBook.runners, strategyConfig.layPrice, stake);
                        } else {
                            logger.log(`Not laying the field. Not configured to place orders`, 'info');
                        }
                    } else {
                        logger.log(`Not laying the field. Excluded number of runners ${activeRunners}`, 'info');
                    }
                } else {
                    logger.log(`Not laying the field. Account balance ${accountFunds.result.availableToBetBalance}`, 'info');
                }
            } else {
                logger.log(`Not laying the field. Favourite price ${favouritePrice}`, 'info');
            }

            return;
        })();
    },

    processTodaysRaces: function(session) {
        const _this = this;

        return promise.coroutine(function*() {
            let startDate = utils.dateOnly(new Date());

            logger.log(`Trading Races on ${utils.dateFormatLong(startDate)}`, 'info');

            // Get current account funds
            const accountFunds = yield account.getAccountFunds(session);

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

            logger.log(`Account funds £${accountFunds.result.availableToBetBalance}. Max liability per trade £${maxLiability}`, 'info');

            // Get today's horse racing meetings
            const meetings = yield bfEvent.todaysHorseEvents(session);

            // Get all win markets for horse events
            const races = yield market.todaysHorseWinMarkets(session);

            // Filter meetings to exclude by venue
            const tradeMeetings = _.filter(meetings.result, function(meeting) {
                return strategyConfig.excludeVenues.indexOf(meeting.event.venue) === -1;
            });

            // Filter races to exclude by venue and class
            const tradeRaces = _.filter(races.result, function(race) {
                let raceClass = race.marketName.substr(race.marketName.indexOf(' ') + 1);
                return ((strategyConfig.excludeVenues.indexOf(race.event.venue) === -1) && (strategyConfig.excludeClasses.indexOf(raceClass) === -1));
            });

            // Grab the horse racing event ids into array
            const eventIds = _.map(tradeMeetings, 'event.id');

            // Loop until the end of the current day - then start all over again
            while (utils.dateOnly(new Date()).getDate() === startDate.getDate()) {

                // Get live race status for horse events
                const currentRaceStatus = yield raceStatus.currentRaceStatus(session, eventIds);

                for (let meeting of currentRaceStatus.result) {
                    // Check if the race status has changed and store
                    _this.processRaceStatus(session, tradeRaces, meeting);
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

            //console.log(placeResult);
            return placeResult;
        })();
    }
};