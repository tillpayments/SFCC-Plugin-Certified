'use strict';

/**
 * This script handles service call and response for deregister request
 */

/* Script includes */
var LogUtils = require('~/cartridge/scripts/utils/tillpaymentLogUtils');
var Logger = LogUtils.getLogger('tillpaymentDeregisterService');
var tillpaymentUtils = require('~/cartridge/scripts/utils/tillpaymentUtils');
var serviceUtils = require('~/cartridge/scripts/init/tillpaymentHttpServiceInit');

var deregisterService = {
    generateRequest: function (UUID, registrationID) {
        var requestParams;
        var requestBody;
        try {
            requestBody = tillpaymentUtils.getDeregisterRequest(UUID, registrationID);
            var authToken = tillpaymentUtils.getAuthenticationToken();
            var requestUrl = tillpaymentUtils.getConfiguration().apiKey + tillpaymentUtils.serviceUtilities.serviceUrls.deregister;
            requestParams = {
                reqBody: requestBody,
                authToken: authToken,
                requestUrl: requestUrl
            };
        } catch (exception) {
            Logger.error('Exception occured while generating Deregister request ' + exception.message);
        }
        return requestParams;
    },
    getServiceResponse: function (UUID, registrationID) {
        var response;
        try {
            var requestParams = deregisterService.generateRequest(UUID, registrationID);
            response = serviceUtils.serviceCall('POST', requestParams.requestUrl, JSON.stringify(requestParams.reqBody), requestParams.authToken);
        } catch (exception) {
            Logger.error('Exception occured in Deregister service execution ' + exception.message);
        }
        return response;
    }
};

module.exports = deregisterService;
