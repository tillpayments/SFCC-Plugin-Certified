'use strict';

/* global jQuery, Resources, Urls */
/* eslint no-alert: 0 */

var j = jQuery.noConflict();

var trans = {
    init: function () {
        if (j('.tillpayment-module .operations-holder').length) {
            this.transOperationsEvents();
        }
    },

    transOperationsEvents: function () {
        j('.operations-holder input[type=text]').on('focus', function () {
            j(this).closest('tr').find('input[type=radio]').prop('checked', true);
        });

        j('.transaction-actions').on('click', function () {
            j('.operations-holder').toggle();
            j(this).text(j.trim(j(this).text()) === Resources.SHOW_ACTIONS ? Resources.HIDE_ACTIONS : Resources.SHOW_ACTIONS);
            j('.operations-holder button[name=submit]').focus();
        });

        // eslint-disable-next-line consistent-return
        j('.operations-holder button').on('click', function () {
            var button = j(this);
            var buttonLabel = button.text();
            var action = j('input[name=operation]:checked').val();
            var orderno = j('input[name=orderno]').val();
            var maxCaptureAmount = parseFloat(j('input[name=maxcaptureamount]').val(), 10);
            var maxRefundAmount = parseFloat(j('input[name=maxrefundamount]').val(), 10);
            var url;
            var postData;
            var amount;

            if (!action) {
                j('.operations-holder .error').text(Resources.CHOOSE_ACTIONS);
                return false;
            }

            if (action === 'capture' && (j('input[name=captureamount]').val() === '' || isNaN(j('input[name=captureamount]').val()))) {
                j('.operations-holder .error').text(Resources.INVALID_CAPTURE_AMOUNT);
                return false;
            }

            if (action === 'refund' && (j('input[name=refundamount]').val() === '' || isNaN(j('input[name=refundamount]').val()))) {
                j('.operations-holder .error').text(Resources.INVALID_REFUND_AMOUNT);
                return false;
            }

            amount = action === 'capture' ? parseFloat(j('input[name=captureamount]').val(), 10) : parseFloat(j('input[name=refundamount]').val(), 10);

            if (action === 'capture') {
                if (amount <= 0.0) {
                    j('.operations-holder .error').text(Resources.INVALID_CAPTURE_AMOUNT);
                    return false;
                } else if (amount > maxCaptureAmount) {
                    j('.operations-holder .error').text(Resources.MAXIMUM_CAPTURE_AMOUNT + maxCaptureAmount);
                    return false;
                }
            }

            if (action === 'refund') {
                if (amount <= 0.0) {
                    j('.operations-holder .error').text(Resources.INVALID_REFUND_AMOUNT);
                    return false;
                } else if (amount > maxRefundAmount) {
                    j('.operations-holder .error').text(Resources.MAXIMUM_REFUND_AMOUNT + maxRefundAmount);
                    return false;
                }
            }

            j('.operations-holder .error').text('');
            url = Urls.operationActions;
            postData = {
                action: action,
                orderno: orderno,
                amount: amount
            };

            button.prop('disabled', true);
            button.text(Resources.TRANSACTION_PROCESSING);

            j.post(url, postData, function (response) {
                button.prop('disabled', false);
                button.text(buttonLabel);

                var result = response || {};

                if (result && result.status) {
                    alert(Resources.TRANSACTION_SUCCESS);
                    window.location.reload();
                } else {
                    alert(Resources.TRANSACTION_FAILED + ' - ' + result.error);
                }
            });
        });

        j('.operations-holder input[type=text]').on('keypress', function (e) {
            var code = e.which;
            var input = j(this);

            if (code === 46) {
                if (input.val() === '') {
                    input.val('0.');
                    e.preventDefault();
                } else if (input.val().indexOf('.') >= 0) {
                    e.preventDefault();
                }
            } else if (code !== 0 && code !== 8 && (code < 48 || code > 57)) {
                e.preventDefault();
            }
        }).on('blur', function () {
            var input = j(this);

            if (input.val() !== '') {
                input.val(parseFloat(input.val(), 10));
            } else if (input.val().indexOf('.') === 0) {
                input.val('0' + input.val());
            }
        });
    }
};

// initialize app
j(document).ready(function () {
    trans.init();
});
