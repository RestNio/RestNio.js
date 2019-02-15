/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Export default param functions and store them for reference in default types:
exports = module.exports;
let $f = module.exports.formatters = require('./formatters');
let $v = module.exports.checks = require('./checks');

// String type
module.exports.string = {
    required: true,
    type: 'string'
}

// Number type
module.exports.number = {
    required: true,
    type: 'number'
}

// Booolean type
module.exports.boolean = {
    required: true,
    type: 'boolean'
}

// Email type
module.exports.email = {
    required: true,
    type: 'string',
    formatters: [$f.str.toLowerCase()],
    checks: [$v.str.email()]
}

// Date type
module.exports.date = {
    required: true,
    type: 'string',
    formatters: [$f.str.toDate()]
}