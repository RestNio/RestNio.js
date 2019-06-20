/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const ms = require('ms');
/**
 * @typedef {import("../../routes/Route").ParamFormatter} ParamFormatter
 */

// Prepare accurate UUID regex. (Thanks to RFC4122!)
const uuidRegex = /^{?([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})}?$/i

 /**
  * @typedef StrFormat
  * @property {() => ParamFormatter} toStr - transforms something to a string.
  * @property {() => ParamFormatter} toLowerCase - transforms the string tolowercase.
  * @property {() => ParamFormatter} toUpperCase - transforms the string TOUPPERCASE.
  * @property {() => ParamFormatter} toObj - creates an object out of the (valid) jsonstring.
  * @property {() => ParamFormatter} toMillis - converts string according to zeit/ms.
  * number strings will become numbers, '10h' will be 36000000 etc. 
  * @property {() => ParamFormatter} toDate - creates a date out of the (valid) datestring.
  * @property {() => ParamFormatter} toTime - creates a datetime out of the current date and a (valid) timestring.
  * @property {() => ParamFormatter} toUuid - transforms the string to valid no-braces uuid if possible.
  */

 module.exports = {
    toStr: () => (value) => String(value),
    toLowerCase: () => (value) => value.toLowerCase(),
    toUpperCase: () => (value) => value.toUpperCase(),
    toObj: () => (value) => JSON.parse(value),
    toMillis: () => (value) => ms(value),
    toDate: () => (value, name) => { 
        let date = new Date(value); 
        if (isNaN(date.getTime())) throw [400, `Invalid date (${value}) specified for ${name}!`];
        return date;
    },
    toTime: () => (value, name) => {
        let date = new Date();
        const timesplit = value.split(':');
        date.setHours(timesplit[0], timesplit[1], timesplit[2] || 0, 0);
        if (isNaN(date.getTime())) throw [400, `Invalid time (${value}) specified for ${name}!`];
        return date;
    },
    toUuid: () => (value, name) => {
        let match = value.match(uuidRegex);
        if (match) {
            return match[1];
        } else {
            throw [400, `Invalid uuid (${value}) specified for ${name}!`];
        }
    }
}