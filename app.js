'use strict';

const config = require('./config/local'),
    logger = require('./lib/logger'),
    promise = require('bluebird'),
    betfair = require('betfair'),
    auth = require('./lib/auth'),
    strategy = require(`./strategy/${config.strategy}`);

let session = new betfair.BetfairSession(config.applicationKey);

return promise.coroutine(function*() {
    // Login
    yield auth.login(session);

    // Initialise configured strategy
    yield strategy.init(session);

    // Logout
    yield auth.logout(session);
})();