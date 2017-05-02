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

            if (favouritePrice > strategyConfig.layPrice) {
                // Lay the field
                const accountFunds = yield account.getAccountFunds(session),
                    maxLiability = (accountFunds.result.availableToBetBalance * (strategyConfig.liabilityPercent / 100)).toFixed(2),
                    stake = (maxLiability / (strategyConfig.layPrice - 1)).toFixed(2);

                logger.log(`${currentMarket.description} - Laying the field of ${activeRunners} runners at ${strategyConfig.layPrice} for £${stake}`, 'info');

                _this.placeLayOrders(session, currentMarket, marketBook.runners, strategyConfig.layPrice, stake);
            } else {
                logger.log(`Not laying the field. Favourite price ${favouritePrice}`, 'info')
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
            const accountFunds = yield account.getAccountFunds(session),
                maxLiability = (accountFunds.result.availableToBetBalance * (strategyConfig.liabilityPercent / 100)).toFixed(2);

            logger.log(`Account funds £${accountFunds.result.availableToBetBalance}. Max liability per trade £${maxLiability}`, 'info');

            // Get today's horse racing meetings
            const meetings = yield bfEvent.todaysHorseEvents(session);

            // Get all win markets for horse events
            const races = yield market.todaysHorseWinMarkets(session);

            // Grab the horse racing event ids into array
            const eventIds = _.map(meetings.result, 'event.id');

            // Loop until the end of the current day - then start all over again
            while (utils.dateOnly(new Date()).getDate() === startDate.getDate()) {

                // Get live race status for horse events
                const currentRaceStatus = yield raceStatus.currentRaceStatus(session, eventIds);

                for (let meeting of currentRaceStatus.result) {
                    // Check if the race status has changed and store
                    _this.processRaceStatus(session, races.result, meeting);
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
            // Get the market book and trade the market
            //if (currentMarket.marketId === '1.131049943') {
            const marketBook = yield market.listMarketBook(session, [currentMarket.marketId]);

            if (marketBook.result) {
                _this.tradeMarket(session, currentMarket, marketBook.result[0]);
            } else {
                logger.log('Unable to get market book', 'error');
                console.log(marketBook);
            }
            //}

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