'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var ArrayList = require('../../../mocks/dw.util.Collection');
var collections = require('../../../mocks/util/collections');
var mockSuperModule = require('../../../mockModuleSuperModule');
var basePaymentModelMock = require('../../../mocks/models/basePayment');

var PaymentModel;

var paymentMethods = new ArrayList([
    {
        ID: 'GIFT_CERTIFICATE',
        name: 'Gift Certificate'
    },
    {
        ID: 'CREDIT_CARD',
        name: 'Credit Card'
    },
    {
        ID: 'TILL_APM',
        name: 'Till Alternate Payment Methods'
    }
]);

var paymentInstruments = new ArrayList([
    {
        creditCardNumberLastDigits: '1111',
        creditCardHolder: 'The Muffin Man',
        creditCardExpirationYear: 2018,
        creditCardType: 'Visa',
        maskedCreditCardNumber: '************1111',
        paymentMethod: 'CREDIT_CARD',
        creditCardExpirationMonth: 1,
        paymentTransaction: {
            amount: {
                value: 0
            }
        }
    },
    {
        giftCertificateCode: 'someString',
        maskedGiftCertificateCode: 'some masked string',
        paymentMethod: 'GIFT_CERTIFICATE',
        paymentTransaction: {
            amount: {
                value: 0
            }
        }
    },
    {
        paymentMethod: 'TILL_APM',
        custom: {
            tillpaymentApmExtraData: '{"paymentMethod": "PayPal"}'
        },
        paymentTransaction: {
            amount: {
                value: 0
            }
        }
    }
]);

function createApiBasket(options) {
    var basket = {
        totalGrossPrice: {
            value: 'some value'
        }
    };

    if (options && options.paymentMethods) {
        basket.paymentMethods = options.paymentMethods;
    }

    if (options && options.paymentCards) {
        basket.paymentCards = options.paymentCards;
    }

    if (options && options.paymentInstruments) {
        basket.paymentInstruments = options.paymentInstruments;
    }

    return basket;
}

describe('Payment Model', function () {
    before(function () {
        mockSuperModule.create(basePaymentModelMock);
        PaymentModel = proxyquire('../../../../cartridges/int_tillpayment_sfra/cartridge/models/payment', {
            '*/cartridge/scripts/util/collections': collections,
            'dw/order/PaymentMgr': {
                getApplicablePaymentMethods: function () {
                    return [
                        {
                            ID: 'GIFT_CERTIFICATE',
                            name: 'Gift Certificate',
                            imageURL: ''
                        },
                        {
                            ID: 'CREDIT_CARD',
                            name: 'Credit Card',
                            imageURL: ''
                        },
                        {
                            ID: 'TILL_APM',
                            name: 'Till Alternate Payment Methods',
                            imageURL: ''
                        }
                    ];
                },
                getPaymentMethod: function () {
                    return {
                        getApplicablePaymentCards: function () {
                            return [
                                {
                                    cardType: 'Visa',
                                    name: 'Visa',
                                    UUID: 'some UUID'
                                },
                                {
                                    cardType: 'Amex',
                                    name: 'American Express',
                                    UUID: 'some UUID'
                                },
                                {
                                    cardType: 'Master Card',
                                    name: 'MasterCard'
                                },
                                {
                                    cardType: 'Discover',
                                    name: 'Discover'
                                }
                            ];
                        }
                    };
                },
                getApplicablePaymentCards: function () {
                    return ['applicable payment cards'];
                }
            }
        });
    });

    after(function () {
        mockSuperModule.remove();
    });

    it('should take payment Methods and convert to a plain object ', function () {
        var result = new PaymentModel(createApiBasket({ paymentMethods: paymentMethods }), null);
        assert.equal(result.applicablePaymentMethods.length, 3);
        assert.equal(result.applicablePaymentMethods[0].ID, 'GIFT_CERTIFICATE');
        assert.equal(result.applicablePaymentMethods[0].name, 'Gift Certificate');
        assert.equal(result.applicablePaymentMethods[1].ID, 'CREDIT_CARD');
        assert.equal(result.applicablePaymentMethods[1].name, 'Credit Card');
        assert.equal(result.applicablePaymentMethods[2].ID, 'TILL_APM');
        assert.equal(result.applicablePaymentMethods[2].name, 'Till Alternate Payment Methods');
        assert.equal(result.applicablePaymentMethods[2].imageURL, '');
    });

    it('should take payment instruments and convert to a plain object ', function () {
        var result = new PaymentModel(createApiBasket({ paymentInstruments: paymentInstruments }), null);
        assert.equal(
            result.selectedPaymentInstruments.length, 3
        );
        assert.equal(result.selectedPaymentInstruments[0].lastFour, '1111');
        assert.equal(result.selectedPaymentInstruments[0].owner, 'The Muffin Man');
        assert.equal(result.selectedPaymentInstruments[0].expirationYear, 2018);
        assert.equal(result.selectedPaymentInstruments[0].type, 'Visa');
        assert.equal(
            result.selectedPaymentInstruments[0].maskedCreditCardNumber,
            '************1111'
        );
        assert.equal(result.selectedPaymentInstruments[0].paymentMethod, 'CREDIT_CARD');
        assert.equal(result.selectedPaymentInstruments[0].expirationMonth, 1);
        assert.equal(result.selectedPaymentInstruments[0].amount, 0);

        assert.equal(result.selectedPaymentInstruments[1].giftCertificateCode, 'someString');
        assert.equal(
            result.selectedPaymentInstruments[1].maskedGiftCertificateCode,
            'some masked string'
        );
        assert.equal(result.selectedPaymentInstruments[1].paymentMethod, 'GIFT_CERTIFICATE');
        assert.equal(result.selectedPaymentInstruments[1].amount, 0);
        assert.equal(result.selectedPaymentInstruments[2].paymentMethod, 'TILL_APM');
        assert.equal(result.selectedPaymentInstruments[2].amount, 0);
        assert.equal(result.selectedPaymentInstruments[2].tillPaymentMethod, 'PayPal');
    });
});
