'use strict';

/* eslint no-param-reassign: 0 */
/* global empty */

/*
 * utility script to save transaction data
 */

/* API Includes */
var Transaction = require('dw/system/Transaction');

/* Script includes */
var LogUtils = require('~/cartridge/scripts/utils/tillpaymentLogUtils');
var Logger = LogUtils.getLogger('tillpaymentSaveTransaction');


/**
* commit transaction data
* @param {Object} order - order object
* @param {Object} serviceResponse - API response
* @param {Object} transactionHistory - Transaction History
* @param {string} paymentMethod - payment method
*/
function commitTransactionHistory(order, serviceResponse, transactionHistory, paymentMethod) {
    var backendTrasactionEntry = '[]';
    var referenceID = (serviceResponse && serviceResponse.uuid) ? serviceResponse.uuid : '';
    var transactionID = (serviceResponse && serviceResponse.merchantTransactionId) ? serviceResponse.merchantTransactionId : '';
    var transactionTypeVal = (serviceResponse && serviceResponse.transactionType) ? serviceResponse.transactionType : '';
    var transactionStatus = (serviceResponse && serviceResponse.result) ? serviceResponse.result : '';
    var paymentAmount = (serviceResponse && serviceResponse.amount) ? serviceResponse.amount : '';

    if (transactionID) {
        var historyEntry = {
            referenceId: referenceID,
            transactionId: transactionID,
            transactionType: transactionTypeVal,
            paymentStatus: transactionStatus,
            amount: paymentAmount,
            date: (new Date()).getTime()
        };
        transactionHistory.push(historyEntry);
    }

    Transaction.begin();
    order.custom.isTillpaymentOrder = true;
    order.custom.tillPaymentTransactionHistory = JSON.stringify(transactionHistory);

    var iter = order.getPaymentInstruments().iterator();
    var tillPaymentInstrument;
    var paymentInstrument;
    while (iter.hasNext()) {
        tillPaymentInstrument = iter.next();
        if (tillPaymentInstrument.paymentMethod === paymentMethod) {
            paymentInstrument = tillPaymentInstrument;
            break;
        }
    }

    paymentInstrument.custom.tillPaymentTransactionID = transactionID;
    paymentInstrument.custom.tillPaymentTransactionType = transactionTypeVal;
    paymentInstrument.custom.tillPaymentTransactionReference = referenceID;

    if (transactionTypeVal && transactionTypeVal === 'PREAUTHORIZE') {
        paymentInstrument.custom.tillPaymentAuthAmount = Number(paymentAmount);
        paymentInstrument.custom.tillPaymentPaidAmount = Number(0.0);
        paymentInstrument.custom.tillPaymentTransactionStatus = 'Authorized';
        backendTrasactionEntry = {
            capturable: {
                amount: Number(paymentAmount)
            },
            refundable: {
                amount: 0,
                entries: []
            }
        };
        order.custom.tillPaymentCumulativeTransaction = JSON.stringify(backendTrasactionEntry);
    } else if (transactionTypeVal && transactionTypeVal === 'DEBIT') {
        paymentInstrument.custom.tillPaymentCaptureAmount = Number(paymentAmount);
        paymentInstrument.custom.tillPaymentPaidAmount = Number(paymentAmount);
        paymentInstrument.custom.tillPaymentTransactionStatus = 'Captured';
        backendTrasactionEntry = {
            capturable: {
                amount: Number(0.0)
            },
            refundable: {
                amount: Number(paymentAmount),
                entries: [
                    {
                        transaction: referenceID,
                        amount: Number(paymentAmount)
                    }
                ]
            }
        };
        order.custom.tillPaymentCumulativeTransaction = JSON.stringify(backendTrasactionEntry);
    }
    Transaction.commit();
}

/**
* Save order transaction details
* @param {Object} order - order object
* @param {Object} serviceResponse - API response
* @param {string} paymentMethod - payment method
*/
function saveOrderData(order, serviceResponse, paymentMethod) {
    try {
        var transactionHistoryObj = !empty(order.custom.tillPaymentTransactionHistory) ? order.custom.tillPaymentTransactionHistory : '[]';
        var transactionHistory = JSON.parse(transactionHistoryObj);

        if (transactionHistory && transactionHistory.length > 0) {
            for (var i = 0; i < transactionHistory.length; i++) {
                if (transactionHistory[i].transactionId.toString() !== serviceResponse.uuid) {
                    commitTransactionHistory(order, serviceResponse, transactionHistory, paymentMethod);
                }
            }
        } else {
            commitTransactionHistory(order, serviceResponse, transactionHistory, paymentMethod);
        }
    } catch (exception) {
        Logger.error('Exception occured while saving transaction data ' + exception.message);
    }
}

module.exports = {
    saveOrderData: saveOrderData
};
