/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

/**
 * @typedef {import("../../routes/Route").ParamCheck} ParamCheck
 */

 /**
  * @typedef NumCheck
  * @property {() => ParamCheck} isInteger - Checks whether the number is an integer.
  * @property {(max: number) => ParamCheck} max - Checks whether the number is lower or equal than the max specified.
  * @property {(min: number) => ParamCheck} min - Checks whether the number is higher or equal than the min specified.
  * @property {(min: number, max: number) => ParamCheck} range - checks whether the number is inside the specified range. Min including, max ecluding.
  */
module.exports = {
    isInteger: () => (value) => Number.isInteger(value),
    max: (max) => (value) => value <= max,
    min: (min) => (value) => value >= min,
    range: (from, to) => (value) => value >= from && value < to
}