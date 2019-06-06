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

 /**
  * @typedef NumFormat
  * @property {(add: number) => ParamFormatter} add - adds a number to the number.
  * @property {(subtract: number) => ParamFormatter} subtract - subtracts a number from the number.
  * @property {(factor: number) => ParamFormatter} multiply - multiplies a number.
  * @property {(divident: number) => ParamFormatter} devide - divides a number.
  * @property {(exponent: number) => ParamFormatter} raise - raises a number
  * @property {(from: number, to:number) => ParamFormatter} clamp - clamps a number to the specified range (inclusive).
  * @property {([long]: boolean) => ParamFormatter} toTime - converts milliseconds to time string according to zeit/ms.
  * 60000 => "1m", 2 * 60000 => "2m". When long is true, 60000 => "1 minute".
  */

module.exports = {
    add: (add) => (value) => value + add,
    subtract: (subtract) => (value) => value - subtract,
    multiply: (factor) => (value) => value * factor,
    devide: (divident) => (value) => value / divident,
    raise: (exponent) => (value) => value ** exponent,
    clamp: (from, to) => (value) => Math.max(from, Math.min(value, to)),
    toTime: (long = false) => (value) => ms(value, {long})
}