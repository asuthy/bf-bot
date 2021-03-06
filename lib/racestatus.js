'use strict';

const logger = require('./logger'),
    promise = require('bluebird');

module.exports = {

    currentRaceStatus: function(session, eventIds) {
        return promise.coroutine(function*() {
            const request = promise.promisify(session.listRaceDetails, {
                context: session
            });

            const result = yield request({
                meetingIds: eventIds
            }).catch(function(err) {
                logger.log(`Error currentRaceStatus`, 'error');
                console.log(err);
            });

            if (result && result.error) {
                console.log(result);
                console.log(result.error.data.APINGException);
                logger.log(`Unable to currentRaceStatus - ${result.error}`, 'error');
            }

            return result;
        })();
    }
};