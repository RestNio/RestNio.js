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
 * @property {ParamDef} required - Required param of any type.
 * @property {ParamDef} string - Required param of type string.
 * @property {ParamDef} forcedString - Required param of any type, cast to string.
 * Useful if string can for instance be a number or similar.
 * @property {ParamDef} forcedArr - Required param of any type, cast to array.
 * Supports arrays, and commaseperated strings will be put into array.
 * All other values will be returned in array of length = 1.
 * @property {ParamDef} number - Required param of type number.
 * @property {ParamDef} integer - Required param of type integer.
 * An integer can only be a whole number.
 * @property {ParamDef} boolean - Required param of type boolean.
 * @property {ParamDef} email - Required param of type email.
 * An email is a properly email-formatted string.
 * @property {ParamDef} date - Required param of type date.
 * A date is a properly formatted string that is formatted to date object.
 * @property {ParamDef} uuid - Required param of type uuid.
 * A uuid is a uuid formatted conforming RFC4122. Braces are allowed
 * however, they will be automatically cut by the transformer.
 */

module.exports = {
    $f: $f,
    formatters: $f,
    $c: $c,
    checks: $c,

    required: {
        required: true
    },

    string: {
        required: true,
        type: 'string'
    },

    forcedString: {
        required: true,
        formatters: [$f.str.toStr()]
    },

    forcedArr: {
        required: true,
        formatters: [(value) => {
            if (!Array.isArray(value)) {
                if (typeof value === 'string') {
                    return String(value).split(/, ?/)
                } else {
                    return [value];
                }
            }
            return value;
        }]
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
        formatters: [$f.str.toDate()]
    },

    uuid: {
        required: true,
        type: 'string',
        formatters: [$f.str.toUuid()]
    }
    
}