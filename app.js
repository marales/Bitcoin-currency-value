"use strict";

var VectorWatch = require('vectorwatch-sdk');
var StorageProvider = require('vectorwatch-storageprovider');
var Schedule = require('node-schedule');
var vectorWatch = new VectorWatch();
var request = require('request');
var logger = vectorWatch.logger;

var storageProvider = new StorageProvider();
vectorWatch.setStorageProvider(storageProvider);

vectorWatch.on('config', function(event, response) {
    logger.info('config');

    var what = response.createGridList('currency');
    what.addOption('USD');
    what.addOption('GBP');
    what.addOption('EUR');
    what.addOption('RON');

    response.send();
});

vectorWatch.on('subscribe', function(event, response) {
    logger.info('subscribe');

    // getting the selected currency
    var currency = event.getUserSettings().settings.currency.name;
        
    getCurrencyValue(currency).then(function(value) {
        logger.info('subscribe : current currency value : ' + value + currency);
        response.setValue(format(value, currency));
        response.send();
     }).catch(function(e) {
        logger.error(e);
        response.setValue('N/A');
        response.send();
    });

});

vectorWatch.on('unsubscribe', function(event, response) {
    logger.info('unsubscribe');
    response.send();
});

function getCurrencyValue(currency) {
    return new Promise(function (resolve, reject) {
        var url = 'http://api.coindesk.com/v1/bpi/currentprice/' + encodeURIComponent(currency.toUpperCase()) + '.json';
        
        request(url, function (error, httpResponse, body) {
            if (error) {
                reject('call error: ' + error.message + ' for ' + url);
                return;
            }

            if (httpResponse && httpResponse.statusCode != 200) {
                reject('call error: ' + httpResponse.statusCode + ' for ' + url);
                return;
            }

            try {
                body = JSON.parse(body);
                resolve(body.bpi[currency].rate_float);
            } catch(err) {
                reject('malformed json response from ' + url + ': ' + err.message);
            }

        });
    });
}

function pushUpdates() {
    logger.info('push updates');
    
    storageProvider.getAllUserSettingsAsync().then(function(records) {
        records.forEach(function(record) {
            var currency = record.userSettings.currency.name;
            getCurrencyValue(currency).then(function(value) {
                logger.info('push updates : current currency value : ' + value + currency);
                vectorWatch.pushStreamValue(record.channelLabel, format(value, currency));
            }).catch(function(e) {
                logger.error(e);
            }); 
        });
    });
}

function scheduleJob() {
    var scheduleRule = new Schedule.RecurrenceRule();
    scheduleRule.minute = [0, 15, 30, 45];
    Schedule.scheduleJob(scheduleRule, pushUpdates);
}

function format(value, currency){
    value = value.toString();
    return value.substring(0, value.indexOf('.') + 3)  + ' ' + currency;
}

vectorWatch.createServer(scheduleJob);
