'use strict';

/**
 * This script handles service call and response for register request
 */

/* Script includes */
var LogUtils = require('~/cartridge/scripts/utils/tillpaymentLogUtils');
var Logger = LogUtils.getLogger('tillpaymentRegisterService');
var tillpaymentUtils = require('~/cartridge/scripts/utils/tillpaymentUtils');
var serviceUtils = require('~/cartridge/scripts/init/tillpaymentHttpServiceInit');

var registerService = {
    generateRequest: function (customer, paymentForm, UUID) {
        var requestParams;
        var requestBody;
        try {
            requestBody = tillpaymentUtils.getRegisterRequest(customer, paymentForm, UUID);
            var authToken = tillpaymentUtils.getAuthenticationToken();
            var requestUrl = tillpaymentUtils.getConfiguration().apiKey + tillpaymentUtils.serviceUtilities.serviceUrls.register;
            requestParams = {
                reqBody: requestBody,
                authToken: authToken,
                requestUrl: requestUrl
            };
        } catch (exception) {
            Logger.error('Exception occured while generating Register request ' + exception.message);
        }
        return requestParams;
    },
    getServiceResponse: function (customer, paymentForm, UUID) {
        var response;
        try {
            var requestParams = registerService.generateRequest(customer, paymentForm, UUID);
            response = serviceUtils.serviceCall('POST', requestParams.requestUrl, JSON.stringify(requestParams.reqBody), requestParams.authToken);
        } catch (exception) {
            Logger.error('Exception occured in Register service execution ' + exception.message);
        }
        return response;
    }
};

module.exports = registerService;
