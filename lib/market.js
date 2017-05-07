'use strict';

const logger = require('./logger'),
    promise = require('bluebird'),
    utils = require('./utils');

module.exports = {

    listMarketBook: function(session, marketIds) {
        return promise.coroutine(function*() {
            const request = promise.promisify(session.listMarketBook, {
                context: session
            });

            const result = yield request({
                marketIds: marketIds,
                orderProjection: 'ALL',
                matchProjection: 'NO_ROLLUP',
                priceProjection: {
                    priceData: ['EX_ALL_OFFERS', 'EX_TRADED']
                }
            }).catch(function(err) {
                logger.log(`Error listMarketBook`, 'error');
                console.log(err);
            });

            if (result.error) {
                console.log(result);
                logger.log(`Unable to listMarketBook - ${result.error}`, 'error');
            }

            return result;
        })();
    },

    todaysHorseWinMarkets: function(session) {
        return promise.coroutine(function*() {
            const request = promise.promisify(session.listMarketCatalogue, {
                context: session
            });

            const fromDate = utils.dateOnly(new Date()),
                toDate = utils.addDays(fromDate, 1);

            const result = yield request({
                filter: {
                    eventTypeIds: [7],
                    marketCountries: ['GB'],
                    marketTypeCodes: ['WIN'],
                    marketStartTime: {
                        from: fromDate,
                        to: toDate
                    }
                },
                marketProjection: [
                    'EVENT',
                    'MARKET_START_TIME'
                    /*,
                                        'MARKET_DESCRIPTION',
                                        'RUNNER_DESCRIPTION',
                                        'RUNNER_METADATA'*/
                ],
                maxResults: 1000
            }).catch(function(err) {
                logger.log(`Error todaysHorseWinMarkets`, 'error');
                console.log(err);
            });

            if (result.error) {
                console.log(result);
                logger.log(`Unable to todaysHorseWinMarkets - ${result.error}`, 'error');
            } else {
                // Add raceId to each market to link raceStatus later on
                for (let market of result.result) {
                    market.startTime = new Date(market.marketStartTime);
                    market.raceId = `${market.event.id}.${market.startTime.getUTCHours()}${utils.leadingZero(market.startTime.getMinutes())}`;
                    market.description = `${market.marketName}, ${utils.dateFormatTime(market.startTime)} at ${market.event.venue}`;
                }
            }

            return result;
        })();
    }
};