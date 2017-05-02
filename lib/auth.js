'use strict';

const config = require('../config/local'),
    logger = require('./logger'),
    promise = require('bluebird');

module.exports = {

    login: function(session) {
        return promise.coroutine(function*() {
            const login = promise.promisify(session.login, {
                    context: session
                }),
                loginResult = yield login(config.user, config.password)
                .catch(function(err) {
                    logger.log(`Error logging in`, 'error');
                    console.log(err);
                });

            if (loginResult.success) {
                logger.log(`Logged In`, 'info');
            }
        })();
    },

    logout: function(session) {
        return promise.coroutine(function*() {
            const logoutRequest = promise.promisify(session.logout, {
                context: session
            });

            const logoutResult = yield logoutRequest()
                .catch(function(err) {
                    console.log(err);
                });

            if (logoutResult.success) {
                logger.log(`Logged Out`, 'info');
            }
        })();
    }
};