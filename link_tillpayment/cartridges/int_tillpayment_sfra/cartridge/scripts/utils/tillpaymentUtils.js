'use strict';

/*
 * utility script for tillpayment cartridge
 */

/* global empty, request */
/* eslint guard-for-in: 0 */
/* eslint no-restricted-syntax: 0 */

/* API Includes */
var Site = require('dw/system/Site');
var Resource = require('dw/web/Resource');
var Transaction = require('dw/system/Transaction');
var URLUtils = require('dw/web/URLUtils');
var Locale = require('dw/util/Locale');
var StringUtils = require('dw/util/StringUtils');
var Order = require('dw/order/Order');
var OrderMgr = require('dw/order/OrderMgr');
var MessageDigest = require('dw/crypto/MessageDigest');
var Encoding = require('dw/crypto/Encoding');
var Bytes = require('dw/util/Bytes');
var Crypto = require('dw/crypto');

/* Script includes */
var LogUtils = require('~/cartridge/scripts/utils/tillpaymentLogUtils');
var saveTransactionScript = require('~/cartridge/scripts/utils/tillpaymentSaveTransaction');

// Global Variables
var Utils = {};
var Logger = LogUtils.getLogger('tillpaymentUtils');

/**
* Get gateway authentication for API calls
* @returns {string} auth - basic auth token
*/
Utils.getAuthenticationToken = function () {
    var auth;
    try {
        auth = 'Basic ' + StringUtils.encodeBase64(Utils.getConfiguration().apiUsername + ':' + Utils.getConfiguration().apiPassword);
    } catch (exception) {
        Logger.error('Exception occured while generating basic authentication token ' + exception.message);
    }
    return auth;
};

/**
 * Gets signature for API calls
 * @param {string} payload - request body
 * @param {string} requestUri - request endpoint
 * @returns {Object} signature object
 */
Utils.generateSignature = function (payload, requestUri) {
    var signature;
    var timestamp;

    try {
        var crypto = new MessageDigest(MessageDigest.DIGEST_SHA_512);
        var reqInBytes = new Bytes(payload);
        var hashOfPayload = Encoding.toHex(crypto.digestBytes(reqInBytes));

        timestamp = Utils.getTimeStamp();

        var signatureMessage = Utils.serviceUtilities.serviceConfigs.method + Utils.serviceUtilities.serviceConfigs.newline +
                               hashOfPayload + Utils.serviceUtilities.serviceConfigs.newline +
                               Utils.serviceUtilities.serviceConfigs.contentType + Utils.serviceUtilities.serviceConfigs.newline +
                               timestamp + Utils.serviceUtilities.serviceConfigs.newline +
                               Utils.serviceUtilities.serviceConfigs.uriPrefix + requestUri;
        var hashMac = new Crypto.Mac(Crypto.Mac.HMAC_SHA_512);
        var digestedBytes = hashMac.digest(signatureMessage.toString(), new Bytes(Utils.getConfiguration().sharedSecret, 'UTF-8'));
        signature = Crypto.Encoding.toBase64(digestedBytes);
    } catch (e) {
        Logger.error('Exception occured while generating signature ' + e.message);
    }
    return {
        signature: signature,
        timestamp: timestamp
    };
};

/**
 * Returns current timestamp in specific format
 * @returns {string} timestamp
 */
Utils.getTimeStamp = function () {
    var dayList = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var monthList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var curDateTime = new Date();
    var timestamp = dayList[curDateTime.getUTCDay()] + ', ' +
                    (curDateTime.getUTCDate() < 10 ? ('0' + curDateTime.getUTCDate()) : curDateTime.getUTCDate()) + ' ' +
                    monthList[curDateTime.getUTCMonth()] + ' ' + curDateTime.getUTCFullYear() + ' ' +
                    (curDateTime.getUTCHours() < 10 ? ('0' + curDateTime.getUTCHours()) : curDateTime.getUTCHours()) + ':' +
                    curDateTime.getUTCMinutes() + ':' + curDateTime.getUTCSeconds() + ' ' + Utils.serviceUtilities.serviceConfigs.signatureTimeZone;
    return timestamp;
};

/**
* Prepare preauthorize request object
* @param {Object} order - order object
* @param {Object} paymentForm - checkout payment form object
* @returns {Object} requestObject - request object
*/
Utils.getTransactionRequest = function (order, paymentForm) {
    var requestObject;
    if (order) {
        var billingAddress = order.billingAddress;
        var paymentInstrument;
        var paymentTransaction;

        for (var i = 0; i < order.paymentInstruments.length; i += 1) {
            paymentInstrument = order.paymentInstruments[i];

            if (paymentInstrument.paymentMethod.equals('CREDIT_CARD')) {
                paymentTransaction = paymentInstrument.paymentTransaction;
                break;
            }
        }

        requestObject = {
            merchantTransactionId: order.orderNo,
            merchantMetaData: 'CREDIT_CARD',
            amount: paymentTransaction.amount.value.toString(),
            currency: order.getCurrencyCode(),
            successUrl: URLUtils.https('TillpaymentResponse-Success', 'orderNo', order.orderNo, 'orderToken', order.orderToken).toString(),
            cancelUrl: URLUtils.https('TillpaymentResponse-Cancel', 'orderNo', order.orderNo, 'orderToken', order.orderToken).toString(),
            errorUrl: URLUtils.https('TillpaymentResponse-Error', 'orderNo', order.orderNo, 'orderToken', order.orderToken).toString(),
            callbackUrl: URLUtils.https('TillpaymentResponse-Callback').toString(),
            description: 'transaction request',
            withRegister: !!(!paymentForm.tillpaymentRegistrationID && paymentForm.creditCardFields.saveCard),
            customer: {
                identification: order.getCustomer().ID,
                firstName: billingAddress.firstName,
                lastName: billingAddress.lastName,
                billingCountry: billingAddress.countryCode.value.toString(),
                email: order.getCustomerEmail()
            },
            threeDSecureData: {
                '3dsecure': Utils.getConfiguration().threeDsecureMode
            }
        };

        if (!paymentForm.tillpaymentRegistrationID) {
            requestObject.cardData = {
                cardHolder: paymentInstrument.getCreditCardHolder(),
                pan: paymentForm.creditCardFields.cardNumber.value,
                cvv: paymentForm.creditCardFields.securityCode.value,
                expirationMonth: paymentInstrument.getCreditCardExpirationMonth(),
                expirationYear: paymentInstrument.getCreditCardExpirationYear()
            };
            requestObject.transactionIndicator = 'SINGLE';
        } else {
            requestObject.referenceUuid = paymentForm.tillpaymentRegistrationID;
            requestObject.transactionIndicator = 'RECURRING';
        }
    }
    return requestObject;
};

/**
* Prepare preauthorize request object
* @param {Object} order - order object
* @param {string} hashedApiPassword - hashed api password
* @param {Object} paymentForm - checkout payment form object
* @returns {Object} requestObject - request object
*/
Utils.getApmRequest = function (order) {
    var requestObject;
    var billingAddress = order.billingAddress;
    var shippingAddress = order.defaultShipment.shippingAddress;
    var paymentInstrument;
    var paymentTransaction;
    var apmExtraData;
    var languageVal = Locale.getLocale(request.getLocale()).getLanguage();

    for (var i = 0; i < order.paymentInstruments.length; i += 1) {
        paymentInstrument = order.paymentInstruments[i];

        if (paymentInstrument.paymentMethod.equals('TILL_APM')) {
            paymentTransaction = paymentInstrument.paymentTransaction;
            apmExtraData = JSON.parse(paymentInstrument.custom.tillpaymentApmExtraData || '{"extraData": {}}').extraData;
            break;
        }
    }

    requestObject = {
        merchantTransactionId: order.orderNo,
        amount: paymentTransaction.amount.value.toString(),
        currency: order.getCurrencyCode(),
        extraData: apmExtraData,
        merchantMetaData: 'TILL_APM',
        successUrl: URLUtils.https('TillpaymentResponse-Success', 'orderNo', order.orderNo, 'orderToken', order.orderToken).toString(),
        cancelUrl: URLUtils.https('TillpaymentResponse-Cancel', 'orderNo', order.orderNo, 'orderToken', order.orderToken).toString(),
        errorUrl: URLUtils.https('TillpaymentResponse-Error', 'orderNo', order.orderNo, 'orderToken', order.orderToken).toString(),
        callbackUrl: URLUtils.https('TillpaymentResponse-Callback').toString(),
        customer: {
            identification: order.getCustomer().ID,
            firstName: billingAddress.firstName,
            lastName: billingAddress.lastName,
            billingAddress1: billingAddress.address1,
            billingAddress2: billingAddress.address2 ? billingAddress.address2 : billingAddress.address1,
            billingCity: billingAddress.city,
            billingPostcode: billingAddress.postalCode,
            billingState: billingAddress.stateCode,
            billingCountry: billingAddress.countryCode.value.toString(),
            billingPhone: billingAddress.phone,
            shippingFirstName: shippingAddress.firstName,
            shippingLastName: shippingAddress.lastName,
            shippingAddress1: shippingAddress.address1,
            shippingAddress2: shippingAddress.address2 ? shippingAddress.address2 : shippingAddress.address1,
            shippingCity: shippingAddress.city,
            shippingPostcode: shippingAddress.postalCode,
            shippingState: shippingAddress.stateCode,
            shippingCountry: shippingAddress.countryCode.value.toString(),
            shippingPhone: shippingAddress.phone,
            email: order.getCustomerEmail()
        },
        threeDSecureData: {
            '3dsecure': Utils.getConfiguration().threeDsecureMode
        },
        language: !empty(languageVal) ? languageVal : Resource.msg('checkout.language.code', 'tillpayment', null)
    };
    return requestObject;
};

/**
 * call respective service based on the payment mode configuration
 * @param {Object} order - order object
 * @param {Object} paymentForm - checkout payment form object
 * @returns {Object} serviceResponse - API call response
 */
Utils.triggerServiceCall = function (order, paymentForm) {
    var serviceResponse;
    var response;
    var errorDescription;

    switch (Utils.getConfiguration().paymentMode) {
        case 'preauth':
            var preAuthoriseScript = require('~/cartridge/scripts/checkout/tillpaymentPreauthoriseService');
            response = preAuthoriseScript.getServiceResponse(order, paymentForm);
            serviceResponse = Utils.handleResponse(order, response);
            break;
        case 'debit':
            var debitScript = require('~/cartridge/scripts/checkout/tillpaymentDebitService');
            response = debitScript.getServiceResponse(order, paymentForm);
            serviceResponse = Utils.handleResponse(order, response);
            break;
        default:
            errorDescription = Utils.getErrorDescription();
            response = {
                error: true,
                errorMessage: errorDescription
            };
            break;
    }
    return serviceResponse;
};

/**
 * call respective service based on the payment mode configuration
 * @param {Object} order - order object.
 * @returns {Object} serviceResponse - API call response
 */
Utils.triggerApmServiceCall = function (order) {
    var serviceResponse;
    var response;
    var errorDescription;

    switch (Utils.getConfiguration().paymentMode) {
        case 'preauth':
            var apmPreauthScript = require('~/cartridge/scripts/checkout/tillpaymentApmPreauthoriseService');
            response = apmPreauthScript.getServiceResponse(order);
            serviceResponse = Utils.handleApmResponse(order, response);
            break;
        case 'debit':
            var apmDebitScript = require('~/cartridge/scripts/checkout/tillpaymentApmDebitService');
            response = apmDebitScript.getServiceResponse(order);
            serviceResponse = Utils.handleApmResponse(order, response);
            break;
        default:
            errorDescription = Utils.getErrorDescription();
            response = {
                error: true,
                errorMessage: errorDescription
            };
            break;
    }
    return serviceResponse;
};

/**
 * call preauthorise script to execute service call
 * @param {Object} order - order object
 * @param {Object} serviceResponse - response from API
 * @returns {Object} response - preauth API call response
 */
Utils.handleResponse = function (order, serviceResponse) {
    var response;
    var errorDescription;

    if (serviceResponse && serviceResponse.success) {
        var returnTypeVal = serviceResponse.returnType;

        if (serviceResponse.uuid) {
            Utils.saveRegistrationID(order, serviceResponse.uuid);
        }
        switch (returnTypeVal.toString()) {
            case 'REDIRECT':
                var redirectUrl = serviceResponse.redirectUrl;

                saveTransactionScript.saveOrderData(order, serviceResponse, 'CREDIT_CARD');
                response = {
                    error: false,
                    redirectUrl: redirectUrl,
                    returnTypeVal: returnTypeVal.toString()
                };
                break;
            case 'FINISHED':
                response = { error: false };
                break;
            case 'ERROR':
                errorDescription = Utils.getErrorDescription(serviceResponse && serviceResponse.code ? serviceResponse.code : '');
                response = {
                    error: true,
                    errorMessage: errorDescription
                };
                break;
            default:
                saveTransactionScript.saveOrderData(order, serviceResponse, 'CREDIT_CARD');
                errorDescription = Utils.getErrorDescription();
                response = {
                    error: true,
                    errorMessage: errorDescription
                };
                break;
        }
    } else {
        errorDescription = Utils.getErrorDescription(serviceResponse && serviceResponse.code ? serviceResponse.code : '');
        response = {
            error: true,
            errorMessage: errorDescription
        };
    }
    return response;
};

/**
 * Saves the returned registration ID to the wallet payment instrument
 * @param {dw.order.Order} order - the order object
 * @param {string} registrationID - the registration ID for wallet payment instrument
 */
Utils.saveRegistrationID = function (order, registrationID) {
    var customer = order.getCustomer();

    if (customer && customer.getProfile()) {
        var UUID = order.custom.tillpaymentCustomerPaymentInstrumentUUID;
        var walletPaymentInstruments = customer.getProfile().getWallet().getPaymentInstruments();
        var walletPaymentInstrumentIterator = walletPaymentInstruments.iterator();
        var walletPaymentInstrument;

        while (walletPaymentInstrumentIterator.hasNext()) {
            walletPaymentInstrument = walletPaymentInstrumentIterator.next();

            if (walletPaymentInstrument.UUID === UUID) {
                this.setCustomAttribute(walletPaymentInstrument, 'tillpaymentRegistrationID', registrationID);
                this.setCustomAttribute(order, 'tillpaymentCustomerPaymentInstrumentUUID', '');
                break;
            }
        }
    }
};

/**
 * call preauthorise script to execute service call
 * @param {Object} order - order object
 * @param {Object} serviceResponse - response from API
 * @returns {Object} response - preauth API call response
 */
Utils.handleApmResponse = function (order, serviceResponse) {
    var response;
    var errorDescription;

    if (serviceResponse && serviceResponse.success === true) {
        var returnTypeVal = serviceResponse.returnType;

        switch (returnTypeVal) {
            case 'REDIRECT':
                var redirectUrl = serviceResponse.redirectUrl;

                response = {
                    error: false,
                    redirectUrl: redirectUrl,
                    returnTypeVal: returnTypeVal.toString()
                };
                break;
            case 'FINISHED':
                response = { error: false };
                break;
            case 'ERROR':
                errorDescription = Utils.getErrorDescription(serviceResponse && serviceResponse.code ? serviceResponse.code : '');
                response = {
                    error: true,
                    errorMessage: errorDescription
                };
                break;
            default:
                errorDescription = Utils.getErrorDescription();
                response = {
                    error: true,
                    errorMessage: errorDescription
                };
                break;
        }
    } else {
        errorDescription = Utils.getErrorDescription(serviceResponse && serviceResponse.code ? serviceResponse.code : '');
        response = {
            error: true,
            errorMessage: errorDescription
        };
    }
    return response;
};

/**
 * handle callback notification data
 * @param {Object} callbackResponse - callback response from API
 */
Utils.handleCallbackNotification = function (callbackResponse) {
    if (callbackResponse) {
        var response = JSON.parse(callbackResponse);
        var order = OrderMgr.getOrder(response.merchantTransactionId);
        var paymentMethod = response.merchantMetaData;
        var orderServiceScript = require('~/cartridge/scripts/checkout/tillpaymentSubmitOrder');
        var paymentStatus = (response && response.result === 'OK');
        if (paymentStatus) {
            var status = orderServiceScript.submitOrder(order);

            if (!status.error && response.transactionType === 'DEBIT') {
                Transaction.begin();
                order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                Transaction.commit();
            }
        } else {
            orderServiceScript.failOrder(order);
        }
        saveTransactionScript.saveOrderData(order, response, paymentMethod);
    }
};

/**
 * Prepare register request object
 * @param {dw.customer.Customer} customer - customer object
 * @param {Object} paymentForm - add payment instrument form object
 * @param {string} UUID - the unique identifier of payment instrument
 * @returns {Object} requestObject - request object
 */
Utils.getRegisterRequest = function (customer, paymentForm, UUID) {
    var requestObject;

    if (customer && customer.profile && paymentForm && UUID) {
        requestObject = {
            cardData: {
                cardHolder: paymentForm.cardOwner.value,
                pan: paymentForm.cardNumber.value,
                expirationMonth: paymentForm.expirationMonth.value,
                expirationYear: paymentForm.expirationYear.value
            },
            merchantTransactionId: 'register-' + UUID,
            successUrl: URLUtils.https('TillpaymentRegisterResponse-Success').toString(),
            cancelUrl: URLUtils.https('TillpaymentRegisterResponse-Cancel').toString(),
            errorUrl: URLUtils.https('TillpaymentRegisterResponse-Error').toString(),
            callbackUrl: URLUtils.https('TillpaymentRegisterResponse-Callback').toString(),
            description: 'register request',
            customer: {
                identification: customer.profile.customerNo,
                firstName: customer.profile.firstName,
                lastName: customer.profile.lastName,
                email: customer.profile.email
            }
        };
        if (customer.addressBook && customer.addressBook.addresses && customer.addressBook.addresses.size() > 0) {
            var address = customer.addressBook.addresses.get(0);
            requestObject.customer.billingCountry = address.countryCode.value.toString();
        }
    }
    return requestObject;
};

/**
 * Prepare deregister request object
 * @param {string} UUID - the unique identifier of payment instrument
 * @param {string} registrationID - the registration ID from when payment instrument was registered
 * @returns {Object} requestObject - request object
 */
Utils.getDeregisterRequest = function (UUID, registrationID) {
    var requestObject;

    if (UUID && registrationID) {
        requestObject = {
            merchantTransactionId: 'deregister-' + UUID,
            referenceUuid: registrationID
        };
    }
    return requestObject;
};

/**
 * call register script to execute service call
 * @param {dw.customer.Customer} customer - customer object
 * @param {Object} paymentForm - add payment instrument form object
 * @param {string} UUID - the unique identifier of payment instrument
 * @returns {Object} response - register API call response
 */
Utils.registerServiceCall = function (customer, paymentForm, UUID) {
    var registerScript = require('~/cartridge/scripts/paymentInstruments/tillpaymentRegisterService');
    var serviceResponse = registerScript.getServiceResponse(customer, paymentForm, UUID);

    return serviceResponse;
};

/**
 * call deregister script to execute service call
 * @param {string} UUID - the unique identifier of payment instrument
 * @param {string} registrationID - the registration ID from when payment instrument was registered
 * @returns {Object} response - deregister API call response
 */
Utils.deregisterServiceCall = function (UUID, registrationID) {
    var deregisterScript = require('~/cartridge/scripts/paymentInstruments/tillpaymentDeregisterService');
    var serviceResponse = deregisterScript.getServiceResponse(UUID, registrationID);

    return serviceResponse;
};

/**
 * Sets the values to custom properties of Extensible Objects
 * and handles the Optimistic Locking errors by using recursion
 * @param {dw.object.ExtensibleObject} object - the object with custom properties
 * @param {string} customAttributeKey - the custom attribute code or key
 * @param {Object} customAttributeValue - the custom attribute value
 */
Utils.setCustomAttribute = function (object, customAttributeKey, customAttributeValue) {
    if (object && customAttributeKey) {
        try {
            Transaction.wrap(function () {
                object.custom[customAttributeKey] = customAttributeValue; // eslint-disable-line no-param-reassign
            });
        } catch (e) {
            Logger.error('Exception occured while setting ' + customAttributeKey + ': ' + e + ', retrying...');
            this.setCustomAttribute(object, customAttributeKey, customAttributeValue);
        }
    }
};

/**
 * Fetches error description as per error code
 *
 * @param {number} responseCode - error code from service response
 * @returns {string} error description
 */
Utils.getErrorDescription = function (responseCode) {
    var errorMessage = '';
    switch (responseCode) {
        case 1000:
            errorMessage = Resource.msg('service.error.1000', 'tillpayment', null);
            break;
        case 1002:
            errorMessage = Resource.msg('service.error.1002', 'tillpayment', null);
            break;
        case 1003:
            errorMessage = Resource.msg('service.error.1003', 'tillpayment', null);
            break;
        case 1004:
            errorMessage = Resource.msg('service.error.1004', 'tillpayment', null);
            break;
        case 2001:
            errorMessage = Resource.msg('service.error.2001', 'tillpayment', null);
            break;
        case 2002:
            errorMessage = Resource.msg('service.error.2002', 'tillpayment', null);
            break;
        case 2003:
            errorMessage = Resource.msg('service.error.2003', 'tillpayment', null);
            break;
        case 2005:
            errorMessage = Resource.msg('service.error.2005', 'tillpayment', null);
            break;
        case 2006:
            errorMessage = Resource.msg('service.error.2006', 'tillpayment', null);
            break;
        case 2007:
            errorMessage = Resource.msg('service.error.2007', 'tillpayment', null);
            break;
        case 2008:
            errorMessage = Resource.msg('service.error.2008', 'tillpayment', null);
            break;
        case 2010:
            errorMessage = Resource.msg('service.error.2010', 'tillpayment', null);
            break;
        case 2011:
            errorMessage = Resource.msg('service.error.2011', 'tillpayment', null);
            break;
        case 2012:
            errorMessage = Resource.msg('service.error.2012', 'tillpayment', null);
            break;
        case 2015:
            errorMessage = Resource.msg('service.error.2015', 'tillpayment', null);
            break;
        case 2016:
            errorMessage = Resource.msg('service.error.2016', 'tillpayment', null);
            break;
        case 2019:
            errorMessage = Resource.msg('service.error.2019', 'tillpayment', null);
            break;
        case 2021:
            errorMessage = Resource.msg('service.error.2021', 'tillpayment', null);
            break;
        case 3003:
            errorMessage = Resource.msg('service.error.3003', 'tillpayment', null);
            break;
        case 3001:
            errorMessage = Resource.msg('service.error.3001', 'tillpayment', null);
            break;
        case 10423:
            errorMessage = Resource.msg('service.error.10423', 'tillpayment', null);
            break;
        default:
            errorMessage = Resource.msg('service.error.default', 'tillpayment', null);
            break;
    }
    return errorMessage;
};

/**
 * Hide sensitive details like customer details on request due to security reasons
 * @param {Object} request - request object
 * @returns {string} toBeFilteredReq - filtered log data
 */
Utils.filterLogData = function (request) {
    var toBeFilteredReq;

    if (request) {
        toBeFilteredReq = typeof request === 'object' ? JSON.parse(JSON.stringify(request)) : JSON.parse(request);

        if (toBeFilteredReq.customer) {
            for (var i in toBeFilteredReq.customer) {
                (toBeFilteredReq.customer)[i.toString()] = '***';
            }
        }

        if (toBeFilteredReq.returnData) {
            for (var j in toBeFilteredReq.returnData) {
                (toBeFilteredReq.returnData)[j.toString()] = '***';
            }
        }

        if (toBeFilteredReq.cardData) {
            for (var k in toBeFilteredReq.cardData) {
                (toBeFilteredReq.cardData)[k.toString()] = '***';
            }
        }
    }
    return JSON.stringify(toBeFilteredReq);
};

/**
 * service configurations
 */
Utils.serviceUtilities = {
    serviceUrls: {
        authorize: '/preauthorize',
        debit: '/debit',
        register: '/register',
        deregister: '/deregister'
    },
    serviceConfigs: {
        method: 'POST',
        newline: '\n',
        contentType: 'application/json; charset=utf-8',
        uriPrefix: '/api/v3/transaction/',
        signatureTimeZone: 'UTC'
    }
};

/**
 * Common configurations
 * @returns {Object} config - configuration values
 */
Utils.getConfiguration = function () {
    var apiUsername = Site.current.getCustomPreferenceValue('tillpaymentApiUsername') || '';
    var apiPassword = Site.current.getCustomPreferenceValue('tillpaymentApiPassword') || '';
    var sharedSecret = Site.current.getCustomPreferenceValue('tillpaymentSharedSecret') || '';
    var apiKey = Site.current.getCustomPreferenceValue('tillpaymentApiKey') || '';
    var apmExtradata = Site.current.getCustomPreferenceValue('tillpaymentApmExtraData') || '';

    if (!(apiUsername && apiPassword && sharedSecret && apiKey && apmExtradata)) {
        Logger.error('Error: Tillpayment Business Manager configurations are missing.');
    }

    var config = {
        apiUsername: apiUsername,
        apiPassword: apiPassword,
        sharedSecret: sharedSecret,
        apiKey: apiKey,
        apmExtradata: apmExtradata,
        isTillpaymentEnabled: Site.current.getCustomPreferenceValue('enableTillpayment') || false,
        paymentMode: Site.current.getCustomPreferenceValue('tillPaymentMode').value || '',
        threeDsecureMode: Site.current.getCustomPreferenceValue('tillpayment3DSecureMode').value || ''
    };

    return config;
};

module.exports = Utils;
