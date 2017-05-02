'use strict';

const logger = require('./logger'),
    promise = require('bluebird'),
    utils = require('./utils');

module.exports = {

    placeOrder: function(session, marketId, bets) {
        return promise.coroutine(function*() {
            const request = promise.promisify(session.placeOrders, {
                context: session
            });

            const result = yield request({
                marketId: marketId,
                instructions: bets
            }).catch(function(err) {
                logger.log(`Error placeOrders`, 'error');
                console.log(err);
            });

            if (result.error) {
                console.log(result.request.params.instructions);
                /*console.log(result);
                console.log(result.error);
                console.log(result.error.data);*/
                logger.log(`Unable to placeOrders - ${result.error.data.APINGException.errorCode}`, 'error');
            }

            return result;
        })();
    }
};