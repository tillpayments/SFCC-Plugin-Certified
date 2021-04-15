/**
* Extends the Payment Instruments logic to call Till Payments for tokenization
*
* @module  controllers/PaymentInstruments
*/

'use strict';

var server = require('server');
var PaymentInstruments = module.superModule;
server.extend(PaymentInstruments);

var CustomerMgr = require('dw/customer/CustomerMgr');
var tillpaymentUtils = require('~/cartridge/scripts/utils/tillpaymentUtils');

server.append(
    'SavePayment',
    function (req, res, next) {
        if (tillpaymentUtils.getConfiguration().isTillpaymentEnabled && res.viewData.success !== false) {
            this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
                var URLUtils = require('dw/web/URLUtils');
                var SortedSet = require('dw/util/SortedSet');
                var Resource = require('dw/web/Resource');
                var Transaction = require('dw/system/Transaction');

                var customer = CustomerMgr.getCustomerByCustomerNumber(
                    req.currentCustomer.profile.customerNo
                );
                var wallet = customer.getProfile().getWallet();
                var walletPaymentInstruments = wallet.getPaymentInstruments();
                var sortedSet = new SortedSet(function (paymentInstrument1, paymentInstrument2) {
                    if (paymentInstrument1.creationDate.getTime() < paymentInstrument2.creationDate.getTime()) {
                        return 1;
                    } else if (paymentInstrument1.creationDate.getTime() > paymentInstrument2.creationDate.getTime()) {
                        return -1;
                    }
                    return 0;
                });
                sortedSet.addAll(walletPaymentInstruments);

                var walletPaymentInstrument = sortedSet.first();
                var UUID = walletPaymentInstrument.UUID || '';
                var paymentForm = server.forms.getForm('creditCard');

                var serviceResponse = tillpaymentUtils.registerServiceCall(customer, paymentForm, UUID);

                if (serviceResponse.success) {
                    tillpaymentUtils.setCustomAttribute(
                        walletPaymentInstrument, 'tillpaymentRegistrationID', serviceResponse.registrationId
                    );
                    res.json({
                        success: true,
                        redirectUrl: URLUtils.url('PaymentInstruments-List').toString()
                    });
                } else {
                    Transaction.wrap(function () {
                        wallet.removePaymentInstrument(walletPaymentInstrument);
                    });
                    res.json({
                        success: false,
                        error: [
                            Resource.msg('account.paymentinstrument.register.error', 'tillpayment', null)
                        ]
                    });
                }
            });
        }
        return next();
    }
);

server.append(
    'DeletePayment',
    function (req, res, next) {
        if (tillpaymentUtils.getConfiguration().isTillpaymentEnabled) {
            var UUID = req.querystring.UUID;
            var customer = CustomerMgr.getCustomerByCustomerNumber(
                req.currentCustomer.profile.customerNo
            );
            var walletPaymentInstruments = customer.getProfile().getWallet().getPaymentInstruments();
            var walletPaymentInstrumentIterator = walletPaymentInstruments.iterator();
            var walletPaymentInstrument;

            while (walletPaymentInstrumentIterator.hasNext()) {
                walletPaymentInstrument = walletPaymentInstrumentIterator.next();

                if (UUID === walletPaymentInstrument.UUID) {
                    break;
                }
            }
            tillpaymentUtils.deregisterServiceCall(UUID, walletPaymentInstrument.custom.tillpaymentRegistrationID);
        }
        return next();
    }
);

module.exports = server.exports();
