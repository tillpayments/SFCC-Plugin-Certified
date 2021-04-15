/**
* This controller provides logic for handling successful/unsuccessful redirects from TILL APIs
*
* @module  controllers/TillpaymentRegisterResponse
*/

'use strict';

/* global request */

/* Script includes */
var LogUtils = require('~/cartridge/scripts/utils/tillpaymentLogUtils');
var Logger = LogUtils.getLogger('tillpaymentResgisterResponse');
var utils = require('~/cartridge/scripts/utils/tillpaymentUtils');

var server = require('server');

server.post(
    'Callback',
    server.middleware.https,
    function (req, res, next) {
        var requestBody = request.httpParameterMap.requestBodyAsString;
        Logger.debug('Callback ' + utils.filterLogData(requestBody));

        res.render('tillPayment/callbackResponse');
        next();
    }
);

server.get(
    'Success',
    server.middleware.https,
    function (req, res, next) {
        res.render('tillPayment/registerResponse');
        next();
    }
);

server.get(
    'Cancel',
    server.middleware.https,
    function (req, res, next) {
        res.render('tillPayment/registerResponse');
        next();
    }
);

server.get(
    'Error',
    server.middleware.https,
    function (req, res, next) {
        res.render('tillPayment/registerResponse');
        next();
    }
);

module.exports = server.exports();
