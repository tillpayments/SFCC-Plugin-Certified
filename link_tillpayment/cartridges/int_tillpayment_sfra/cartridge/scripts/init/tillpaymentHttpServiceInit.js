/*
*    Service call for communication between SFCC connector and Tillpayments REST API
*/

/* Script includes */
var LogUtils = require('~/cartridge/scripts/utils/tillpaymentLogUtils');
var Logger = LogUtils.getLogger('tillpaymentHttpServiceInit');
var tillpaymentUtilities = require('~/cartridge/scripts/utils/tillpaymentUtils');

/* API includes */
var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');

// Global Variables
var tillpaymentsHttpService = {};

/*
*    Communicates with Tillpayments API
*/
tillpaymentsHttpService.serviceCall = function (method, endPoint, requestBody, authToken) {
    var endPointUrl = endPoint;
    var serviceArgs;
    var localService;
    var requestParam;
    localService = LocalServiceRegistry.createService('tillpayments.api.service', {
        createRequest: function (service, args) {
            service.setURL(service.configuration.credential.URL + args.endPointUrl);
            service.setRequestMethod(args.method);
            service.addHeader('Authorization', args.auth);
            service.addHeader('X-Signature', args.signature);
            service.addHeader('Date', args.timestamp);
            service.addHeader('Content-Type', 'application/json; charset=utf-8');
            return args.request;
        },

        /**
        * @param {dw.svc.HTTPService} service - service object
        * @param {Object} responseObject - response returned by the service call
        * @return {Object} response from service call
        */
        parseResponse: tillpaymentsHttpService.serviceParseResponse,

        /**
        * @param {Object} request - log the service request
        * @return {Object} request - log the service request
        */
        getRequestLogMessage: function (request) {
            return tillpaymentUtilities.filterLogData(request);
        },

        /**
        * @param {Object} response - log the service response
        * @return {Object} response - log the service response
        */
        getResponseLogMessage: function (response) {
            return tillpaymentUtilities.filterLogData(response.text);
        }
    });

    requestParam = requestBody || '';
    var signature = tillpaymentUtilities.generateSignature(requestParam, endPointUrl);

    serviceArgs = {
        method: method,
        endPointUrl: endPointUrl,
        request: requestParam,
        auth: authToken,
        signature: signature.signature,
        timestamp: signature.timestamp
    };
    var result = localService.call(serviceArgs);

    if (result.status !== 'OK') {
        Logger.error('Error on service execution: ' + result.errorMessage);
    }
    return result.status === 'OK' ? result.object : result.errorMessage;
};

/*
*    HTTPService configuration parseResponse
*/
tillpaymentsHttpService.serviceParseResponse = function (service, httpClient) {
    var parseResponse;

    if (httpClient.statusCode === 200 || httpClient.statusCode === 201) {
        parseResponse = JSON.parse(httpClient.getText());
        var filterResponse = parseResponse;
        Logger.debug('Http response ' + tillpaymentUtilities.filterLogData(filterResponse));
    } else {
        Logger.error('Error on http request: ' + httpClient.getErrorText());
        parseResponse = null;
    }

    return parseResponse;
};


module.exports = tillpaymentsHttpService;
