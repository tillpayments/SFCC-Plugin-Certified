'use strict';

/* global empty */

var server = require('server');

/* Script includes */
var collections = require('*/cartridge/scripts/util/collections');
var tillpaymentUtilities = require('~/cartridge/scripts/utils/tillpaymentUtils');
var LogUtils = require('*/cartridge/scripts/utils/tillpaymentLogUtils');
var Logger = LogUtils.getLogger('tillpayment_apm');

/* API Includes */
var Transaction = require('dw/system/Transaction');

/**
 * removes other payment instruments from basket and saves TILL_APM
 * @param {dw.order.Basket} basket Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @param {string} paymentMethodID - paymentmethodID
 * @return {Object} returns an error object
 */
function Handle(basket, paymentInformation, paymentMethodID) {
    var currentBasket = basket;
    Transaction.wrap(function () {
        var paymentInstruments = currentBasket.getPaymentInstruments();
        collections.forEach(paymentInstruments, function (item) {
            currentBasket.removePaymentInstrument(item);
        });

        var paymentInstrument = currentBasket.createPaymentInstrument(
            paymentMethodID, currentBasket.totalGrossPrice
        );
        var tillpaymentsForm = server.forms.getForm('tillpayments');
        paymentInstrument.custom.tillpaymentApmExtraData = tillpaymentsForm.APM_extraData.value;
    });

    return { fieldErrors: {}, serverErrors: [], error: false };
}

/**
 * authorizes the payment processor
 * @param {number} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
 * @returns {Object} - errors
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var OrderMgr = require('dw/order/OrderMgr');
    var order = OrderMgr.getOrder(orderNumber);
    var pi = paymentInstrument;
    var paymentMethod = pi.getPaymentMethod();
    if (empty(paymentMethod)) {
        return { error: true };
    }

    Transaction.wrap(function () {
        pi.paymentTransaction.paymentProcessor = paymentProcessor;
        pi.paymentTransaction.setTransactionID(orderNumber);
    });

    if (paymentMethod === 'TILL_APM' && tillpaymentUtilities.getConfiguration().isTillpaymentEnabled) {
        // call tillpayments service api based on the payment mode config
        var tillpaymentsResponse;
        try {
            tillpaymentsResponse = tillpaymentUtilities.triggerApmServiceCall(order);
        } catch (exception) {
            Logger.error('Exception occoured in APM Authorize of processor ' + exception.message);
        }
        return tillpaymentsResponse;
    }
}

exports.Handle = Handle;
exports.Authorize = Authorize;
