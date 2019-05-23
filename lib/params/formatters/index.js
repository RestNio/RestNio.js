/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

/**
 * @typedef Formatters
 * @property {import("./Num").NumFormat} num - number formatters.
 * @property {import("./Str").StrFormat} str - string formatters.
 */

module.exports = {
    num: require('./Num'),
    str: require('./Str')
}