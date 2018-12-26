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

// Email type
module.exports.email = {
    required: true,
    type: 'string',
    formatters: [$f.str.toLowerCase()],
    checks: [$v.str.email()]
}