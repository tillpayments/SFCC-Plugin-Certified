'use strict';
/* global request */

/*
*    This script handles request, response and service call of APM debit payment mode
*/

/* Script includes */
var LogUtils = require('~/cartridge/scripts/utils/tillpaymentLogUtils');
var Logger = LogUtils.getLogger('tillpaymentApmDebitService');
var tillpaymentUtils = require('~/cartridge/scripts/utils/tillpaymentUtils');
var serviceUtils = require('~/cartridge/scripts/init/tillpaymentHttpServiceInit');

var debitPaymentService = {

    generateRequest: function (order) {
        var requestParams;
        try {
            var requestBody = tillpaymentUtils.getApmRequest(order);
            var authToken = tillpaymentUtils.getAuthenticationToken();
            var requestUrl = tillpaymentUtils.getConfiguration().apmApiKey + tillpaymentUtils.serviceUtilities.serviceUrls.debit;
            requestParams = {
                reqBody: requestBody,
                authToken: authToken,
                requestUrl: requestUrl
            };
        } catch (exception) {
            Logger.error('Exception occured while generating APM debit request ' + exception.message);
        }
        return requestParams;
    },

    getServiceResponse: function (order) {
        var response;
        try {
            var requestParams = debitPaymentService.generateRequest(order);
            response = serviceUtils.apmServiceCall('POST', requestParams.requestUrl, JSON.stringify(requestParams.reqBody), requestParams.authToken);
        } catch (exception) {
            Logger.error('Exception occured in APM debit service execution ' + exception.message);
        }
        return response;
    }

};

module.exports = debitPaymentService;
