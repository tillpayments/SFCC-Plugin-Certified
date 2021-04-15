/*
*   Creates custom log file for the cartridge
*/

// API Includes
var Logger = require('dw/system/Logger');
var Resource = require('dw/web/Resource');

// Global Variables
var defaultLogFilePrefix = Resource.msg('log.filename', 'tillpayment', null);

var Utils = {};

Utils.getLogger = function (category) {
    if (category) {
        return Logger.getLogger(defaultLogFilePrefix, category);
    }
    return Logger.getLogger(defaultLogFilePrefix);
};

/**
 * Returns round value of a number in Tillpayment order details page
 * @param {number} value - number
 * @returns {number} round number
 */
Utils.round = function (value) {
    var num = Math.round(value * 100) / 100;
    if (Math.abs(num) < 0.0001) {
        return 0.0;
    }
    return num;
};

/**
 * Send mail to end customer when a refund is performed at backoffice
 * @param {dw.order.Order} order - order object
 * @param {number} amount - refunded amount
 */
Utils.sendRefundEmail = function (order, amount) {
    var Site = require('dw/system/Site');
    var emailHelpers = require('*/cartridge/scripts/helpers/emailHelpers');

    var objectForEmail = {
        customerName: order.getCustomerName(),
        OrderNo: order.getOrderNo(),
        orderAmount: order.getTotalNetPrice().value + order.getTotalTax().value,
        refundedAmount: amount
    };

    var emailObj = {
        to: order.customerEmail,
        subject: Resource.msg('subject.refund.notification.email', 'tillpayment', null),
        from: Site.current.getCustomPreferenceValue('customerServiceEmail') || 'no-reply@testorganization.com'
    };

    emailHelpers.sendEmail(emailObj, 'refund/refundNotificationEmail', objectForEmail);
};

module.exports = Utils;
