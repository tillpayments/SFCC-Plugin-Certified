'use strict';

/* global $ */

var processInclude = require('base/util');

$(document).ready(function () {
    processInclude(require('./checkout/checkout'));
});
