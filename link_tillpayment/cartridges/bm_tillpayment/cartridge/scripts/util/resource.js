/**
 * Resource helper
 *
 */
function ResourceHelper() {}

/**
 * Get the client-side resources of a given page
 * @returns {Object} An objects key key-value pairs holding the resources
 */
ResourceHelper.getResources = function () {
    var Resource = require('dw/web/Resource');

    // application resources
    var resources = {
        // Transaction operation messages
        SHOW_ACTIONS: Resource.msg('operations.show.actions', 'tillpayment', null),
        HIDE_ACTIONS: Resource.msg('operations.hide.actions', 'tillpayment', null),
        CHOOSE_ACTIONS: Resource.msg('operations.actions', 'tillpayment', null),
        CHOOSE_ORDERS: Resource.msg('operations.orders', 'tillpayment', null),
        TRANSACTION_SUCCESS: Resource.msg('transaction.success', 'tillpayment', null),
        TRANSACTION_FAILED: Resource.msg('transaction.failed', 'tillpayment', null),
        TRANSACTION_PROCESSING: Resource.msg('operations.wait', 'tillpayment', null),
        INVALID_CAPTURE_AMOUNT: Resource.msg('capture.amount.validation', 'tillpayment', null),
        INVALID_REFUND_AMOUNT: Resource.msg('refund.amount.validation', 'tillpayment', null),
        MAXIMUM_REFUND_AMOUNT: Resource.msg('maximum.refund.amount', 'tillpayment', null),
        MAXIMUM_CAPTURE_AMOUNT: Resource.msg('maximum.capture.amount', 'tillpayment', null)

    };
    return resources;
};

/**
 * Get the client-side URLs of a given page
 * @returns {Object} An objects key key-value pairs holding the URLs
 */
ResourceHelper.getUrls = function () {
    var URLUtils = require('dw/web/URLUtils');

    // application urls
    var urls = {
        operationActions: URLUtils.url('Operations-Action').toString()
    };
    return urls;
};

module.exports = ResourceHelper;
