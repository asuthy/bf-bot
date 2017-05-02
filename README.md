## migration-check
Module to check the integrity of a migration by comaparing data from the source and destination databases


## Help

	node app.js --help
	node app.js -h

## Checking Configuration Data
Check the configuration data

	node app.js -c
	node app.js --config

## Checking Batch Data
Check the batch data

	node app.js -b -n 1-10
	node app.js --batch --number 1-10

## Setup
Create config/local.js:

	module.exports = {
    	connections: {
        	pgsk: {
    	        host: 'localhost',
    	        port: 5433,
    	        user: 'postgres',
    	        password: 'password',
    	        database: 'sk',
    	        client: 'pg',
    	        pool: {
    	            min: 2,
    	            max: 20
    	        }
    	    },
    	    sybase: {
    	        host: '192.168.64.36',
    	        port: 5000,
    	        database: 'asutherland',
    	        user: 'sa',
    	        password: 'password'
    	    }
    	},
    	log: {
    	    level: 'debug'
    	}
	};
