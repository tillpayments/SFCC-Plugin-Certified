'use strict';

/**
 * TillPayment Transaction Actions
 */

/* global empty, request */
/* eslint no-use-before-define: 0 */

/* API Includes */
var OrderMgr = require('dw/order/OrderMgr');
var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var Order = require('dw/order/Order');

/* Script Modules */
var utils = require('int_tillpayment_sfra/cartridge/scripts/init/tillpaymentHttpServiceInit');
var tillUtils = require('~/cartridge/scripts/util/tillPaymentUtils');
var apiHelperJSON = require('int_tillpayment_sfra/cartridge/scripts/utils/tillpaymentUtils');

var log = tillUtils.getLogger('TransActions');

var VOID = Resource.msg('feature.void', 'tillpayment', null);
var CAPTURE = Resource.msg('feature.capture', 'tillpayment', null);
var REFUND = Resource.msg('feature.refund', 'tillpayment', null);

/**
 * Call action
 * @param {Object} request - request object
 * @param {Order} orderObj - order object
 * @param {string} actionType - of the transaction
 * @returns {Object} response
 */
function callAction(request, orderObj, actionType) {
    var usedAPIType = paymentAPIType(orderObj);
    var endPoint = usedAPIType.getEndpoint() + Resource.msg('api.transaction.' + actionType, 'tillpayment', null);
    var authCode = usedAPIType.getAPIAuthenticationToken();
    var response;
    if (orderObj.getPaymentInstruments()[0].getPaymentMethod() === 'TILL_APM') {
        response = utils.apmServiceCall('POST', endPoint, JSON.stringify(request), authCode);
    } else {
        response = utils.serviceCall('POST', endPoint, JSON.stringify(request), authCode);
    }
    return response;
}

/**
 * Call refund action
 * @param {Object} refundAmount - Refund amount
 * @param {Object} order - Order object
 * @param {Object} actionType - Transaction type
 * @param {Object} serviceResponse - Service response object
 * @returns {Object} response
 */
function refundCallAction(refundAmount, order, actionType, serviceResponse) {
    var request;
    var amount;
    var refundBalance = parseFloat(refundAmount, 10);
    var cumulativeTransaction;
    var cumulativeTransactionString;
    var localServiceResponse = serviceResponse;

    while (refundBalance) {
        cumulativeTransactionString = order.custom.tillPaymentCumulativeTransaction || '{}';
        cumulativeTransaction = JSON.parse(cumulativeTransactionString);

        if (cumulativeTransaction.refundable.entries.length) {
            var referenceId = cumulativeTransaction.refundable.entries[0].transaction;
            var entryAmount = cumulativeTransaction.refundable.entries[0].amount;

            if (refundBalance < entryAmount) {
                amount = refundBalance;
                refundBalance = 0;
            } else {
                amount = entryAmount;
                refundBalance -= entryAmount;
                refundBalance = tillUtils.round(refundBalance);
            }

            request = prepareRequest(order, amount, actionType, referenceId);
            var response = callAction(request, order, actionType);
            var processedResponse = {};

            if (response && response.success) {
                processedResponse = handleSuccessResponse(response, actionType);
                localServiceResponse.status = true;
                localServiceResponse.error = 'false';
                var paymentInstrument = order.getPaymentInstruments()[0];
                var requestAmount = amount;

                var alreadyPaidAmount = 'tillPaymentPaidAmount' in paymentInstrument.custom ? paymentInstrument.custom.tillPaymentPaidAmount : 0.0;
                requestAmount = tillUtils.round(parseFloat(alreadyPaidAmount) - parseFloat(amount));
                addRefundStatusOnTxnHistory(order, referenceId);
                setOrderAttributesHistory(actionType, order, processedResponse, requestAmount, amount);

                if (requestAmount === 0) {
                    updateOrderStatus(order, actionType);
                }

                if (order.getCustomerEmail()) {
                    tillUtils.sendRefundEmail(order, amount);
                }
            } else {
                localServiceResponse.error = handleErrorResponse(response);
                return localServiceResponse;
            }

            udpateCumulativeTransaction(order, amount, actionType, referenceId);
        }
    }

    return localServiceResponse;
}

/**
 * Updates the order status
 * @param {string} order - order object
 * @param {string} actionType ex: Capture/Void/Refund
 */
function updateOrderStatus(order, actionType) {
    try {
        if (order) {
            Transaction.begin();
            if (actionType === VOID || actionType === REFUND) {
                order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
                order.setStatus(Order.ORDER_STATUS_CANCELLED);
                order.setCancelCode('6');
                order.setCancelDescription('Set manually by TillPayment API.');
                order.setExportStatus(Order.EXPORT_STATUS_NOTEXPORTED);
            } else if (actionType === CAPTURE) {
                order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                order.setExportStatus(Order.EXPORT_STATUS_READY);
            }

            Transaction.commit();
        }
    } catch (e) {
        Transaction.rollback();
        log.error('Exception occurred while updating the order status after Refund Transaction' + e);
    }
}

/**
 * Keeps the transaction details in order custom attributes and history
 * @param {string} action - transaction action
 * @param {Object} order - order object
 * @param {Object} response -response object
 * @param {string} paidAmount - paid amount
 * @param {string} amount - amount
 */
function setOrderAttributesHistory(action, order, response, paidAmount, amount) {
    var transactionHistory = order.custom.tillPaymentTransactionHistory || '[]';
    var paidAmountNumeric = parseFloat(paidAmount);
    var paymentInstrument = order.getPaymentInstruments()[0];
    var capturedAmount = 'tillPaymentCaptureAmount' in paymentInstrument.custom ? paymentInstrument.custom.tillPaymentCaptureAmount : 0.0;
    var alreadyPaidAmount = 'tillPaymentPaidAmount' in paymentInstrument.custom ? paymentInstrument.custom.tillPaymentPaidAmount : 0.0;

    if (action === CAPTURE) {
        capturedAmount += paidAmountNumeric;
        paidAmountNumeric = tillUtils.round(alreadyPaidAmount + paidAmountNumeric); // eslint-disable-line no-param-reassign
        Transaction.wrap(function () {
        });
    }

    try {
        transactionHistory = JSON.parse(transactionHistory);

        if (response.transactionType) {
            transactionHistory.push({
                referenceId: response.referenceId || '',
                transactionType: response.transactionType || '',
                transactionId: order.orderNo || '',
                paymentStatus: response.paymentStatus || '',
                amount: amount || paidAmount,
                action: action,
                date: (new Date()).getTime()
            });
        }
    } catch (e) {
        log.error('Exception occurred while parsing transactionHistory' + e);
    }


    Transaction.wrap(function () {
        paymentInstrument.custom.tillPaymentTransactionID = order.orderNo || ''; // eslint-disable-line no-param-reassign
        paymentInstrument.custom.tillPaymentTransactionReference = response.referenceId || ''; // eslint-disable-line no-param-reassign
        paymentInstrument.custom.tillPaymentTransactionType = response.transactionType || ''; // eslint-disable-line no-param-reassign
        paymentInstrument.custom.tillPaymentCaptureAmount = capturedAmount; // eslint-disable-line no-param-reassign
        paymentInstrument.custom.tillPaymentPaidAmount = paidAmountNumeric; // eslint-disable-line no-param-reassign
        paymentInstrument.custom.tillPaymentTransactionStatus = response.paymentStatus || ''; // eslint-disable-line no-param-reassign
        order.custom.tillPaymentTransactionHistory = JSON.stringify(transactionHistory); // eslint-disable-line no-param-reassign
    });
}

/**
 * To add refund flag on transaction history if refund is done for that capture.
 * @param {Order} order - order object
 * @param {string} referenceId of the transaction
 */
function addRefundStatusOnTxnHistory(order, referenceId) {
    var transactionHistory = getTransactionHistory(order);
    Transaction.wrap(function () {
        for (var i = 0; i < transactionHistory.length; i++) {
            if (transactionHistory[i].referenceId === referenceId) {
                transactionHistory[i].refundStatus = 'Refunded';
                // eslint-disable-next-line no-param-reassign
                order.custom.tillPaymentTransactionHistory = JSON.stringify(transactionHistory);
            }
        }
    });
}

/**
 * To parse and get transactionHistory.
 * @param {Order} order - order object
 * @returns {Object} Transaction History object
 */
function getTransactionHistory(order) {
    if (empty(order)) {
        log.error('getTransactionHistory: order object is empty.');
    }
    var transactionHistory;
    try {
        transactionHistory = 'tillPaymentTransactionHistory' in order.custom ? order.custom.tillPaymentTransactionHistory : [];
        transactionHistory = JSON.parse(transactionHistory);
    } catch (error) {
        log.error('getTransactionHistory: Error on parsing transactionHistory');
    }
    return transactionHistory;
}

/**
 * Generate Void Request
 * @param {Order} orderObj Object
 * @returns {Object} transaction object
 */
function makeVoidRequest(orderObj) {
    var referenceId;
    var transactionHistory = getTransactionHistory(orderObj);

    for (var i = 0; i < transactionHistory.length; i++) {
        if (transactionHistory[i].transactionType === 'PREAUTHORIZE') {
            referenceId = transactionHistory[i].referenceId;
        }
    }
    return {
        merchantTransactionId: request.requestID,
        referenceUuid: referenceId
    };
}

/**
 * Cancel(void) operation
 * @param {string} orderNo - order no
 * @param {string} actionType ex: Capture/Void/Refund
 * @returns {Object} response
 */
exports.cancel = function (orderNo, actionType) {
    return handleAPICalls(orderNo, '', actionType);
};

/**
 * Generate Capture Request
 * @param {Object} orderObj - order object
 * @param {string} amount - capture amount
 * @param {string} transactionID - transaction id
 * @returns {Object} transaction details
 */
function makeCaptureRequest(orderObj, amount) {
    var currency = orderObj.getCurrencyCode();
    var referenceId;
    var transactionHistory = getTransactionHistory(orderObj);

    for (var i = 0; i < transactionHistory.length; i++) {
        if (transactionHistory[i].transactionType === 'DEBIT' || transactionHistory[i].transactionType === 'PREAUTHORIZE') {
            referenceId = transactionHistory[i].referenceId;
        }
    }

    return {
        merchantTransactionId: request.requestID,
        referenceUuid: referenceId,
        amount: amount,
        currency: currency
    };
}

/**
 * Capture action
 * @param {string} orderNo - order no
 * @param {string} amount - Capture amount
 * @param {string} actionType ex: Capture/Void/Refund
 * @returns {Object} response
 */
exports.capture = function (orderNo, amount, actionType) {
    return handleAPICalls(orderNo, amount, actionType);
};

/**
 * Generate refund Request
 * @param {Object} order - order object
 * @param {string} amount - refund amount
 * @returns {Object} transaction details
 * @param {string} referenceId of that capture which need to be refunded.
 */
function makeRefundRequest(order, amount, referenceId) {
    var UUIDUtils = require('dw/util/UUIDUtils');
    var currency = order.getCurrencyCode();

    return {
        merchantTransactionId: UUIDUtils.createUUID(),
        referenceUuid: referenceId,
        amount: amount,
        currency: currency
    };
}

/**
 * Refund action
 * @param {string} orderNo - order no
 * @param {string} amount - refund amount
 * @param {string} actionType ex: Capture/Void/Refund
 * @param {string} ReferenceID of that capture which need to be refunded.
 * @returns {Object} response
 */
exports.refund = function (orderNo, amount, actionType) {
    return handleAPICalls(orderNo, amount, actionType);
};

/**
 * Handles API calls response
 * @param {string} orderNo - order no
 * @param {string} amount - refund amount
 * @param {string} actionType ex: Capture/Void/Refund
 * @returns {Object} response
 */
function handleAPICalls(orderNo, amount, actionType) {
    var serviceResponse = {
        status: false,
        error: ''
    };
    var orderObj = OrderMgr.getOrder(orderNo);
    try {
        var response;
        var request;
        if (actionType === 'refund') {
            serviceResponse = refundCallAction(amount, orderObj, actionType, serviceResponse);
        } else {
            request = prepareRequest(orderObj, amount, actionType);
            response = callAction(request, orderObj, actionType);
            var processedResponse = {};

            if (response && response.success) {
                processedResponse = handleSuccessResponse(response, actionType);
                serviceResponse.status = true;
                serviceResponse.error = 'false';
                var paymentInstrument = orderObj.getPaymentInstruments()[0];
                var requestAmount = amount;

                switch (actionType) { // eslint-disable-line default-case
                    case CAPTURE:
                        setOrderAttributesHistory(actionType, orderObj, processedResponse, requestAmount);
                        udpateCumulativeTransaction(orderObj, amount, actionType, response.uuid);
                        updateOrderStatus(orderObj, actionType);
                        break;
                    case VOID:
                        requestAmount = 'tillPaymentPaidAmount' in paymentInstrument.custom ? paymentInstrument.custom.tillPaymentPaidAmount : 0.0;
                        udpateCumulativeTransaction(orderObj, amount, actionType, '');
                        setOrderAttributesHistory(actionType, orderObj, processedResponse, requestAmount);
                        updateOrderStatus(orderObj, actionType);
                        break;
                }
            } else {
                serviceResponse.error = handleErrorResponse(response);
            }
        }
    } catch (e) {
        log.error('Exception occurred on handleAPICalls: ' + e.message);
        return serviceResponse;
    }

    return serviceResponse;
}


/**
 * Prepares transaction request object
 * @param {Object} orderObj Order object
 * @param {string} amount transaction amount
 * @param {string} actionType ex: Capture/Void/Refund
 * @param {string} referenceId of that capture which need to be refunded.
 * @returns {Object} request object
 */
function prepareRequest(orderObj, amount, actionType, referenceId) {
    var requestBody;
    switch (actionType) { // eslint-disable-line default-case
        case CAPTURE:
            requestBody = makeCaptureRequest(orderObj, amount);
            break;
        case VOID:
            requestBody = makeVoidRequest(orderObj);
            break;
        case REFUND:
            requestBody = makeRefundRequest(orderObj, amount.toString(), referenceId);
            break;
    }
    return requestBody;
}

/**
 * Handling the success response
 * @param {Object} response - service response
 * @param {string} transactionType - of API service
 * @returns {Object} amount
 */
function handleSuccessResponse(response, transactionType) {
    switch (transactionType) {
        case CAPTURE:
            // eslint-disable-next-line no-param-reassign
            transactionType += Resource.msg('suffix.d', 'tillpayment', null);
            break;
        case REFUND || VOID:
            // eslint-disable-next-line no-param-reassign
            transactionType += Resource.msg('suffix.ed', 'tillpayment', null);
            break;
        default:
    }

    return {
        referenceId: response.uuid,
        transactionType: transactionType.toUpperCase(),
        paymentStatus: response.returnType
    };
}

/**
 * Handling the error response.
 * @param {Object} response - service response
 * @returns {string} error message
 */
function handleErrorResponse(response) {
    var error;
    if (response && !response.success) {
        error = response.errors ? response.errors[0].errorMessage : response.errorMessage;
    } else {
        error = 'Service is unavailable.';
    }
    log.debug('API error response: ' + error);
    return error;
}

/**
 * Updating Cumulative Transaction JSON
 * @param {Object} orderObj - order object
 * @param {string} transAmount - transaction amount
 * @param {string} transactionType ex: Capture/Void/Refund
 * @param {string} captureReferenceId of that transaction
 */
function udpateCumulativeTransaction(orderObj, transAmount, transactionType, captureReferenceId) {
    var cumulativeTransaction = orderObj.custom.tillPaymentCumulativeTransaction || '{}';
    var paymentInstrument = orderObj.getPaymentInstruments()[0];
    var paidAmount = parseFloat(paymentInstrument.custom.tillPaymentPaidAmount || 0.0, 10);
    var captureAmount = parseFloat(paymentInstrument.custom.tillPaymentAuthAmount || 0.0, 10) - parseFloat(paymentInstrument.custom.tillPaymentCaptureAmount || 0.0, 10);
    var capturableAmount = captureAmount;
    var refundableAmount = paidAmount;
    var amount = parseFloat(transAmount, 10);

    cumulativeTransaction = JSON.parse(cumulativeTransaction);

    if (cumulativeTransaction.capturable) {
        capturableAmount = cumulativeTransaction.capturable.amount || 0.0;
    }

    if (cumulativeTransaction.refundable) {
        refundableAmount = cumulativeTransaction.refundable.amount || 0.0;
    }

    switch (transactionType) {
        case CAPTURE:
            cumulativeTransaction.capturable.amount = tillUtils.round(capturableAmount - amount);
            cumulativeTransaction.refundable.amount += amount;
            cumulativeTransaction.refundable.entries.push({
                transaction: captureReferenceId,
                amount: amount
            });
            break;
        case REFUND:
            cumulativeTransaction.refundable.amount = tillUtils.round(refundableAmount - amount);
            for (var i = 0; i < cumulativeTransaction.refundable.entries.length; i++) {
                if (cumulativeTransaction.refundable.entries[i].transaction === captureReferenceId) {
                    if (cumulativeTransaction.refundable.entries[i].amount === amount) {
                        cumulativeTransaction.refundable.entries.splice(i, 1);
                    } else {
                        cumulativeTransaction.refundable.entries[i].amount -= amount;
                    }
                    break;
                }
            }

            break;
        case VOID:
            cumulativeTransaction = {
                capturable: {
                    amount: 0
                },
                refundable: {
                    amount: 0,
                    entries: []
                }
            };
            break;
        default:
    }

    Transaction.begin();
    // eslint-disable-next-line no-param-reassign
    orderObj.custom.tillPaymentCumulativeTransaction = JSON.stringify(cumulativeTransaction);
    Transaction.commit();
}

/**
 * Gets payment API Credentials based on payment method used
 * @param {Order} orderObj - order object
 * @returns {Object} set of relevant API credentials
 */
function paymentAPIType(orderObj) {
    // Does order exists and has a PaymentInstruments
    if (empty(orderObj) && orderObj.getPaymentInstruments().length === 0) {
        log.debug('getPaymentAPIType(): No PaymentInstrument available in the order');
        return;
    }
    // Is this order using TillPayment as PSP
    if ('isTillpaymentOrder' in orderObj.custom && orderObj.custom.isTillpaymentOrder) {
        var apiType = APITYPE.jsonAPI;

        return { // eslint-disable-line consistent-return
            getAPIAuthenticationToken: function () {
                return apiType.setAPIAuthenticationToken();
            },
            getEndpoint: function () {
                return apiType.setEndpoint(orderObj.getPaymentInstruments()[0].getPaymentMethod());
            }
        };
    }
}

/** provider specific implemenation */
var APITYPE = {
    jsonAPI: {
        setAPIAuthenticationToken: function () {
            return apiHelperJSON.getAuthenticationToken();
        },
        setEndpoint: function (paymentMethod) {
            if (paymentMethod === 'TILL_APM') {
                return apiHelperJSON.getConfiguration().apmApiKey;
            }
            return apiHelperJSON.getConfiguration().apiKey;
        }
    }
};
