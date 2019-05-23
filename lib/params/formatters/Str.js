/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

/**
 * @typedef {import("../../routes/Route").ParamFormatter} ParamFormatter
 */

 /**
  * @typedef StrFormat
  * @property {() => ParamFormatter} toLowerCase - transforms the string tolowercase.
  * @property {() => ParamFormatter} toUpperCase - transforms the string TOUPPERCASE.
  * @property {() => ParamFormatter} toDate - creates a date out of the (valid) datestring.
  * @property {() => ParamFormatter} toObj - creates an object out of the (valid) jsonstring.
  */

  /**
   * @exports
   */
 module.exports = {
    toLowerCase: () => (value) => value.toLowerCase(),
    toUpperCase: () => (value) => value.toUpperCase(),
    toDate: () => (value) => new Date(value),
    toObj: () => (value) => JSON.parse(value)
}