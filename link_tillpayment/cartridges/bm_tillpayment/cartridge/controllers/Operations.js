'use strict';

/**
 * Controller for TillPayment payment
 *
 */

var server = require('server');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

/**
 * redirects to specific actions
 * */
server.post('Action', server.middleware.https, csrfProtection.validateAjaxRequest, function (req, res, next) {
    var action = req.form.action;
    var orderNo = req.form.orderno;
    var amount = req.form.amount;
    var transActions = require('*/cartridge/scripts/transActions');
    var result;

    switch (action) {
        case 'capture':
            result = transActions.capture(orderNo, amount, action);
            break;
        case 'cancel':
            result = transActions.cancel(orderNo, action);
            break;
        case 'refund':
            result = transActions.refund(orderNo, amount, action);
            break;
        // no default
    }
    res.json(result);
    next();
});

module.exports = server.exports();
