## bf-bot


## Setup
Create config/local.js:

	module.exports = {
        user: 'username',
        password: 'password',
        applicationKey: 'appkey',
        log: {
            level: 'silly'
        },
        strategy: 'horseinplaylayfield',
        strategies: {
            horseinplaylayfield: {
                eventStatusRefreshMs: 10000,
                liabilityPercent: 1,
                layPrice: 1.80
            }
        }
    };
