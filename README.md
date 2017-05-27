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
        strategy: 'horseinplaylayfieldscored',
        strategies: {
            horseinplaylayfield: {
                placeOrders: false,
                eventStatusRefreshMs: 10000,
                liabilityPercent: 1,
                layPrice: 1.80,
                excludeRunners: [],
                excludeVenues: [],
                excludeClasses: []
            },
            horseinplaylayfieldscored: {
                placeOrders: true,
                eventStatusRefreshMs: 10000,
                liabilityPercent: 1,
                fixedStakeAmount: 2,
                layPrice: 1.80,
                scoreTargetOffset: 0,
                runnerScores: [],
                venueScores: [],
                raceClassScores: [],
                hourScores: []
            }
        }
    };
