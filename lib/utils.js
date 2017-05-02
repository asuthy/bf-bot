'use strict';

const _ = require('lodash');

function addTimeInterval(date, interval, amount) {
    return moment(new Date(date)).add(amount, interval).toDate();
};

module.exports = {

    getEventFromEventId: function(bfEvents, eventId) {
        return _.find(bfEvents, function(bfEvent) {
            return bfEvent.event.id === eventId;
        });
    },

    getMarketFromRaceId: function(races, raceId) {
        return _.find(races, function(race) {
            return race.raceId === raceId;
        });
    },

    getMinPriceFromRunners: function(runners) {
        let odds = 1000;

        for (let runner of runners) {
            if (runner.status === 'ACTIVE' && runner.lastPriceTraded < odds) {
                odds = runner.lastPriceTraded;
            }
        }

        return odds;
    },

    sleep: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    dateOnly: function(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    },

    addDays: function(date, days) {
        return new Date(date.getTime() + 1000 * 60 * 60 * 24);
    },

    dateFormatLong: function(date) {
        const dateOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };

        return date.toLocaleDateString('en-GB', dateOptions);
    },

    dateFormatTime: function(date) {
        const timeOptions = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };

        return date.toLocaleTimeString([], timeOptions);
    },

    leadingZero(str) {
        str = str.toString();
        if (str.length === 1) {
            str = '0' + str;
        }
        return str;
    }
};