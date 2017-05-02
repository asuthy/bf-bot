'use strict';

const logger = require('./logger'),
    promise = require('bluebird');

module.exports = {

    getAccountFunds: function(session) {
        return promise.coroutine(function*() {
            const request = promise.promisify(session.getAccountFunds, {
                context: session
            });

            const result = yield request({
                filter: {}
            }).catch(function(err) {
                logger.log(`Error getting account funds`, 'error');
                console.log(err);
            });

            if (result.error) {
                if (result.error.data.APINGException) {
                    logger.log(`Unable to get account funds - ${result.error.data.APINGException.errorCode}`, 'error');
                } else if (result.error.data.AccountAPINGException) {
                    logger.log(`Unable to get account funds - ${result.error.data.AccountAPINGException.errorCode}`, 'error');
                }
            }

            return result;
        })();
    }
};