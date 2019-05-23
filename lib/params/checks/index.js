/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

/**
 * @typedef Checks
 * @property {import("./Num").NumCheck} num - number checkers.
 * @property {import("./Str").StrCheck} str - string checkers.
 */

module.exports = {
    num: require('./Num'),
    str: require('./Str')
}