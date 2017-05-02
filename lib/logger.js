'use strict';

const winston = require('winston'),
    config = require('../config/local.js');

winston.remove(winston.transports.Console);

winston.add(winston.transports.Console, {
    level: config.log.level,
    handleExceptions: true,
    colorize: true
});

module.exports = {

    log: function(msg, level) {
        if (!level) {
            level = 'info';
        }

        winston.log(level, msg);
    }
};