var chai = require('chai');
var config = require('../it.config');
var request = require('request-promise').defaults({ simple: false });
var chaiSubset = require('chai-subset');
var assert = chai.assert;
var baseUrl = config.baseUrl;
chai.use(chaiSubset);
var cookieJar = request.jar();

describe('PaymentInstruments-SavePayment', function () {
    describe('When credit card was used', function () {
        this.timeout(20000);

        it('should successfully add credit card method to a wallet', function () {
            var myRequest = {
                method: 'POST',
                rejectUnauthorized: false,
                resolveWithFullResponse: true,
                jar: cookieJar,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                url: baseUrl + '/PaymentInstruments-SavePayment'
            };


            return request(myRequest)
                .then(function (res) { // eslint-disable-line no-unused-vars
                    var reqData = Object.assign({}, myRequest);
                    myRequest.url = baseUrl + '/CSRF-Generate';
                    cookieJar.setCookie(request.cookie(cookieJar.getCookieString(reqData.url), reqData.url));
                    return request(myRequest);
                })
                // adding payment method
                .then(function (res) {
                    var reqData = Object.assign({}, myRequest);
                    var csrfJsonResponse = JSON.parse(res.body);
                    reqData.url = baseUrl + '/PaymentInstruments-SavePayment';
                    reqData.form = {
                        dwfrm_billing_addressFields_firstName: 'Sathya',
                        dwfrm_billing_addressFields_lastName: 'Kasi',
                        dwfrm_billing_addressFields_address1: '12344  wilson Street',
                        dwfrm_billing_addressFields_country: 'US',
                        dwfrm_billing_addressFields_states_stateCode: 'AK',
                        dwfrm_billing_addressFields_city: 'Wales',
                        dwfrm_billing_addressFields_postalCode: '87024',
                        isTillpaymentEnabled: 'true',
                        dwfrm_billing_paymentMethod: 'CREDIT_CARD',
                        dwfrm_billing_contactInfoFields_email: 'djfhsdmvd;sfmd;c@example.com',
                        dwfrm_billing_contactInfoFields_phone: '3333333333',
                        dwfrm_billing_creditCardFields_cardOwner: 'Sathya Kasi',
                        dwfrm_billing_creditCardFields_cardType: 'Master',
                        tillpayPaymentMethodNonce: 'fake-valid-nonce',
                        tillpayIs3dSecureRequired: false
                    };
                    reqData.form[csrfJsonResponse.csrf.tokenName] = csrfJsonResponse.csrf.token;
                    cookieJar.setCookie(request.cookie(cookieJar.getCookieString(reqData.url), reqData.url));
                    return request(reqData);
                })
                .then(function (res) {
                    assert.equal(res.statusCode, 200, 'Expected PaymentInstruments-SavePayment request statusCode to be 200.');
                });
        });
    });
});
