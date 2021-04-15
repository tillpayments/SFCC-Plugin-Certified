'use strict';
/* global request */

/*
*    This script submits order
*/

/* Script includes */
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var LogUtils = require('~/cartridge/scripts/utils/tillpaymentLogUtils');
var Logger = LogUtils.getLogger('tillpaymentSubmitOrder');

/* API Includes */
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Transaction = require('dw/system/Transaction');

var orderService = {

    submitOrder: function (order) {
        var orderPlacementStatus;
        var response = {
            error: false
        };

        try {
            if (order.getStatus().value === Order.ORDER_STATUS_CREATED) {
                Transaction.begin();
                orderPlacementStatus = OrderMgr.placeOrder(order);
                Transaction.commit();

                if (!orderPlacementStatus.error) {
                    Transaction.begin();
                    order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
                    order.setExportStatus(Order.EXPORT_STATUS_READY);
                    Transaction.commit();

                    if (order.getCustomerEmail()) {
                        COHelpers.sendConfirmationEmail(order, request.locale);
                    }
                    response = {
                        error: false
                    };
                } else {
                    response = orderService.failOrder(order);
                }
            }
        } catch (exception) {
            Logger.error('Exception occured while submitting order ' + exception.message);
        }
        return response;
    },

    failOrder: function (order) {
        Transaction.wrap(function () {
            OrderMgr.failOrder(order, true);
        });
        var response = {
            error: true,
            errorMessage: 'Order can not be submitted due to some error'
        };
        return response;
    }
};

module.exports = orderService;
