/**
* Extending the checkout module
*
* @module  controllers/Checkout
*/

'use strict';

var server = require('server');

var Checkout = module.superModule;
server.extend(Checkout);

server.append(
    'Begin',
    function (req, res, next) {
        var tillpaymentsForm = server.forms.getForm('tillpayments');
        var tillErrorMessage = req.querystring.tillErrorMessage;
        res.render('checkout/checkout', {
            tillErrorMessage: tillErrorMessage,
            customForms: {
                tillpaymentsForm: tillpaymentsForm
            }
        });
        next();
    }
);

module.exports = server.exports();
