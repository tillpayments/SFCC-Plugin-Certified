'use strict';
/* global request */

/*
*    This script handles request, response and service call of APM preauthorise payment mode
*/

/* Script includes */
var LogUtils = require('~/cartridge/scripts/utils/tillpaymentLogUtils');
var Logger = LogUtils.getLogger('tillpaymentApmPreauthoriseService');
var tillpaymentUtils = require('~/cartridge/scripts/utils/tillpaymentUtils');
var serviceUtils = require('~/cartridge/scripts/init/tillpaymentHttpServiceInit');


var authorisePaymentService = {

    generateRequest: function (order) {
        var requestParams;
        var requestBody;
        try {
            requestBody = tillpaymentUtils.getApmRequest(order);
            var authToken = tillpaymentUtils.getAuthenticationToken();
            var requestUrl = tillpaymentUtils.getConfiguration().apiKey + tillpaymentUtils.serviceUtilities.serviceUrls.authorize;
            requestParams = {
                reqBody: requestBody,
                authToken: authToken,
                requestUrl: requestUrl
            };
        } catch (exception) {
            Logger.error('Exception occured while generating APM preauthorise request ' + exception.message);
        }
        return requestParams;
    },

    getServiceResponse: function (order) {
        var response;
        try {
            var requestParams = authorisePaymentService.generateRequest(order);
            response = serviceUtils.serviceCall('POST', requestParams.requestUrl, JSON.stringify(requestParams.reqBody), requestParams.authToken);
        } catch (exception) {
            Logger.error('Exception occured in APM preauthorise service execution ' + exception.message);
        }
        return response;
    }

};

module.exports = authorisePaymentService;
