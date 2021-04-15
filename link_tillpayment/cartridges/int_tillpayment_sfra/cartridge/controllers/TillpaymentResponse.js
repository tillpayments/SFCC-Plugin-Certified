/**
* Controller which handles all the asynchronous responses from tillpayment
*
* @module  controllers/TillpaymentResponse
*/

'use strict';

var server = require('server');

var LogUtils = require('~/cartridge/scripts/utils/tillpaymentLogUtils');
var Logger = LogUtils.getLogger('TillpaymentResponse');
var utils = require('~/cartridge/scripts/utils/tillpaymentUtils');
var orderServiceScript = require('~/cartridge/scripts/checkout/tillpaymentSubmitOrder');

var OrderMgr = require('dw/order/OrderMgr');

/**
* processes the response returned by tillpayment once the payment is done
*/
server.get('Success', server.middleware.https, function (req, res, next) {
    var order = OrderMgr.getOrder(req.querystring.orderNo, req.querystring.orderToken);
    orderServiceScript.submitOrder(order);

    res.render('tillPayment/paymentResponse', {
        status: 'Success',
        order: order
    });
    next();
});

server.post('Callback', server.middleware.https, function (req, res, next) {
    var callbackResponse = req.body;
    Logger.debug('callback response: ' + utils.filterLogData(callbackResponse));
    utils.handleCallbackNotification(callbackResponse);
    res.render('tillPayment/callbackResponse');
    next();
});

server.get('Error', function (req, res, next) {
    var order = OrderMgr.getOrder(req.querystring.orderNo, req.querystring.orderToken);
    orderServiceScript.failOrder(order);

    res.render('tillPayment/paymentResponse', {
        status: 'Error'
    });
    next();
});

server.get('Cancel', function (req, res, next) {
    var order = OrderMgr.getOrder(req.querystring.orderNo, req.querystring.orderToken);
    orderServiceScript.failOrder(order);

    res.render('tillPayment/paymentResponse', {
        status: 'Cancel'
    });
    next();
});

module.exports = server.exports();
