'use strict';
/* global request */

/*
*    This script handles request, response and service call of debit payment mode
*/

/* Script includes */
var LogUtils = require('~/cartridge/scripts/utils/tillpaymentLogUtils');
var Logger = LogUtils.getLogger('tillpaymentDebitService');
var tillpaymentUtils = require('~/cartridge/scripts/utils/tillpaymentUtils');

var debitPaymentService = {

    generateRequest: function (order, paymentForm) {
        var requestParams;
        var requestBody;
        try {
            requestBody = tillpaymentUtils.getTransactionRequest(order, paymentForm);
            var authToken = tillpaymentUtils.getAuthenticationToken();
            var requestUrl = tillpaymentUtils.getConfiguration().apiKey + tillpaymentUtils.serviceUtilities.serviceUrls.debit;
            requestParams = {
                reqBody: requestBody,
                authToken: authToken,
                requestUrl: requestUrl
            };
            Logger.debug('Debit request body ' + tillpaymentUtils.filterLogData(requestBody));
        } catch (exception) {
            Logger.error('Exception occured while generating debit request ' + exception.message);
        }
        return requestParams;
    },

    getServiceResponse: function (order, paymentForm) {
        var response;
        try {
            var serviceUtils = require('~/cartridge/scripts/init/tillpaymentHttpServiceInit');
            var requestParams = debitPaymentService.generateRequest(order, paymentForm);
            response = serviceUtils.serviceCall('POST', requestParams.requestUrl, JSON.stringify(requestParams.reqBody), requestParams.authToken);
        } catch (exception) {
            Logger.error('Exception occured in debit service execution ' + exception.message);
        }
        return response;
    }

};

module.exports = debitPaymentService;
