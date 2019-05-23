/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Export default param functions and store them for reference in default types:
let $f = require('./formatters');
let $c = require('./checks');

/**
 * @typedef {import("../routes/Route").ParamDef} ParamDef
 * @typedef {import("../params/formatters").Formatters} Formatters
 * @typedef {import("../params/checks").Checks} Checks
 */

/**
 * @typedef Params
 * @property {Formatters} $f - access to built-in formatters.
 * @property {Formatters} formatters - access to built-in formatters.
 * @property {Checks} $c - access to built-in checks.
 * @property {Checks} checks - access to built-in checks.
 * 
 * @property {ParamDef} string - Required param of type string.
 * @property {ParamDef} number - Required param of type number.
 * @property {ParamDef} integer - Required param of type integer.
 * An integer can only be a whole number.
 * @property {ParamDef} boolean - Required param of type boolean.
 * @property {ParamDef} email - Required param of type email.
 * An email is a properly email-formatted string.
 * @property {ParamDef} date - Required param of type date.
 * A date is a properly formatted string that is formatted to date object.
 */

module.exports = {
    $f: $f,
    formatters: $f,
    $c: $c,
    checks: $c,

    string: {
        required: true,
        type: 'string'
    },

    number: {
        required: true,
        type: 'number'
    },

    integer: {
        required: true,
        type: 'number',
        checks: [$c.num.isInteger()]
    },
    
    boolean: {
        required: true,
        type: 'boolean'
    },

    email: {
        required: true,
        type: 'string',
        formatters: [$f.str.toLowerCase()],
        checks: [$c.str.email()]
    },

    date: {
        required: true,
        type: 'string',
        formatters: [$f.str.toDate()]
    }
    
}