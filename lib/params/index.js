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
 * Date can also be given in milliseconds after EPOCH.
 * @property {ParamDef} uuid - Required param of type uuid.
 * A uuid is a uuid formatted conforming RFC4122. Braces are allowed
 * however, they will be automatically cut by the transformer.
 * @property {(...options: String) => ParamDef} enum - Required param of type string,
 * where only the specified options are allowed. Hint: you can spread a string array 
 * out by passing ...array.
 * @property {(regex: RegExp, valuetype: string) => ParamDef} regexString - Required param of type string,
 * which is only past if the specified RegExp passes successfully. Valuetype can be specified to give the
 * user a better hint of the variable type when the input does not match the regexp. Regular expression
 * must be passed as a javascript RegExp.
 * @property {ParamDef} relativeTime - Required param with relative time in millis.
 * Param ultimately returns a number. Param can be given as zeit/ms string.
 * IE: 555 => 555, "1s" => 1000 etc.
 * @property {ParamDef} relativeDate - Param with relative input pointng to absolute datetime.
 * Param ultimately returns a Date object. Datetime is given in either
 * relative millis (-1000 is one second before now) or in zeit/ms string
 * ('2 days' is 2 days after now). Defaults to current datetime.
 * @property {ParamDef} time - Required param of type string, formatted like
 * hh:mm with optional :ss. Transformed to datetime of current date with that
 * specified time.
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
    },
    enum: (...options) => ({
        required: true,
        formatters: [$f.str.toStr()],
        checks: [(value) => options.includes(value)]
    }),
    regexString: (regex, valuetype = 'string') => ({
        required: true,
        formatters: [$f.str.toStr()],
        checks: [$c.str.regex(regex, valuetype)]
    }),
    relativeTime: {
        required: true,
        formatters: [$f.str.toStr(), $f.str.toMillis()]
    },
    relativeDate: {
        required: false,
        default: () => new Date(),
        ignoreEmptyString: true,
        formatters: [
            $f.str.toStr(), 
            $f.str.toMillis(),
            (value) => Date.now() + value,
            $f.str.toDate()
        ]
    },
    time: {
        required: true,
        type: 'string',
        formatters: [$f.str.toTime()]
    }
    
}