/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

// Imports
/**
 * @typedef {import("../../routes/Route").ParamFormatter} ParamFormatter
 */

// Prepare accurate UUID regex. (Thanks to RFC4122!)
const uuidRegex = /^{?([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})}?$/i

 /**
  * @typedef StrFormat
  * @property {() => ParamFormatter} toLowerCase - transforms the string tolowercase.
  * @property {() => ParamFormatter} toUpperCase - transforms the string TOUPPERCASE.
  * @property {() => ParamFormatter} toDate - creates a date out of the (valid) datestring.
  * @property {() => ParamFormatter} toObj - creates an object out of the (valid) jsonstring.
  * @property {() => ParamFormatter} toUuid - transforms the string to valid no-braces uuid if possible.
  */

 module.exports = {
    toLowerCase: () => (value) => value.toLowerCase(),
    toUpperCase: () => (value) => value.toUpperCase(),
    toDate: () => (value) => new Date(value),
    toObj: () => (value) => JSON.parse(value),
    toUuid: () => (value, name, reject) => {
        let match = value.match(uuidRegex);
        if (match) {
            return match[1];
        } else {
            reject(`Invalid uuid (${value}) specified for ${name}!`);
        }
    }
}