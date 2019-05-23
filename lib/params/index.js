/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Export default param functions and store them for reference in default types:
exports = module.exports;

let $f = module.exports.$f = module.exports.formatters = require('./formatters');
let $v = module.exports.$c = module.exports.checks = require('./checks');

/**
 * =String Type=
 * Required param of type string.
 */
module.exports.string = {
    required: true,
    type: 'string'
}

/**
 * =Number Type=
 * Required param of type number.
 */
module.exports.number = {
    required: true,
    type: 'number'
}

/**
 * =Integer Type=
 * Required param of type integer.
 * Only accepts whole numbers.
 */
module.exports.integer = {
    required: true,
    type: 'number',
    checks: [$v.num.isInteger()]
}

/**
 * =Boolean Type=
 * Required param of type boolean.
 */
module.exports.boolean = {
    required: true,
    type: 'boolean'
}

/**
 * =Email Type=
 * Required param of type email.
 * An email is a properly email-
 * formatted string.
 */
module.exports.email = {
    required: true,
    type: 'string',
    formatters: [$f.str.toLowerCase()],
    checks: [$v.str.email()]
}

/**
 * =Date Type=
 * Required param of type date.
 * Date is a properly formatted string
 * that is formatted to date object.
 */
module.exports.date = {
    required: true,
    type: 'string',
    formatters: [$f.str.toDate()]
}