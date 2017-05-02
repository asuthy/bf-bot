'use strict';

const logger = require('./logger'),
    promise = require('bluebird'),
    utils = require('./utils');

module.exports = {

    todaysHorseEvents: function(session) {
        return promise.coroutine(function*() {
            const request = promise.promisify(session.listEvents, {
                context: session
            });

            const fromDate = utils.dateOnly(new Date()),
                toDate = utils.addDays(fromDate, 1);

            const result = yield request({
                filter: {
                    eventTypeIds: [7],
                    marketCountries: ['GB', 'IE'],
                    marketTypeCodes: ['WIN'],
                    marketStartTime: {
                        from: fromDate,
                        to: toDate
                    }
                }
            }).catch(function(err) {
                logger.log(`Error todaysHorseEvents`, 'error');
                console.log(err);
            });

            if (result.error) {
                console.log(result);
                logger.log(`Unable to todaysHorseEvents - ${result.error}`, 'error');
            }

            return result;
        })();
    }
};