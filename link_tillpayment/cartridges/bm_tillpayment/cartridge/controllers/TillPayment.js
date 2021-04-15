'use strict';

/**
 * Controller for Order management pages
 *
 */

/* global request */

/* API Includes */
var ISML = require('dw/template/ISML');


/* Script Modules */
var utils = require('*/cartridge/scripts/util/tillPaymentUtils');
var OrderMgr = require('dw/order/OrderMgr');

/**
 * TillPayment Order List page
 * */
function orderList() {
    var pageSize = request.httpParameterMap.pagesize.value;
    var pageNumber = request.httpParameterMap.pagenumber.value;
    var orderNumber = request.httpParameterMap.ordernumber.value || '';
    var orderListResponse;

    pageSize = pageSize ? parseInt(pageSize, 10) : 10;
    pageNumber = pageNumber ? parseInt(pageNumber, 10) : 1;

    orderListResponse = require('*/cartridge/scripts/getOrders').output({
        pageSize: pageSize,
        pageNumber: pageNumber,
        orderNumber: orderNumber
    });
    ISML.renderTemplate('application/orderlist', orderListResponse);
}


/**
 * TillPayment Order Details page
 * */
function orderDetails() {
    var resourceHelper = require('*/cartridge/scripts/util/resource');
    var orderNo = request.httpParameterMap.OrderNo.stringValue;
    var order = OrderMgr.getOrder(orderNo);
    var paymentInstrument = order.getPaymentInstruments()[0];
    var dueAmount = utils.round(order.getTotalGrossPrice().value - (paymentInstrument.custom.tillPaymentPaidAmount || 0.0));
    var paidAmount = utils.round(paymentInstrument.custom.tillPaymentPaidAmount || 0.0);
    var authAmount = utils.round(paymentInstrument.custom.tillPaymentAuthAmount || 0.0);
    var captureAmount = utils.round(paymentInstrument.custom.tillPaymentAuthAmount - paymentInstrument.custom.tillPaymentCaptureAmount || 0.0);
    var cumulativeTransaction = order.custom.tillPaymentCumulativeTransaction || '{}';
    var transactionHistory = order.custom.tillPaymentTransactionHistory || '[]';
    cumulativeTransaction = JSON.parse(cumulativeTransaction);
    var capturableAmount = captureAmount;
    var refundableAmount = paidAmount;

    if (cumulativeTransaction.capturable) {
        capturableAmount = utils.round(cumulativeTransaction.capturable.amount || 0);
        capturableAmount = Math.abs(capturableAmount);
    }

    if (cumulativeTransaction.refundable) {
        refundableAmount = utils.round(cumulativeTransaction.refundable.amount || 0);
    }

    ISML.renderTemplate('application/orderdetails', {
        resourceHelper: resourceHelper,
        order: order,
        transactionHistory: transactionHistory,
        dueAmount: dueAmount,
        paidAmount: paidAmount,
        authAmount: authAmount,
        capturableAmount: capturableAmount,
        refundableAmount: refundableAmount
    });
}

/*
 * Exposed web methods
 */
orderList.public = true;
orderDetails.public = true;

exports.OrderList = orderList;
exports.OrderDetails = orderDetails;
