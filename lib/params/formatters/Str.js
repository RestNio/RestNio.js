/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

class Str {

    static toLowerCase() {
        return (value) => value.toLowerCase();
    }

    static toUpperCase() {
        return (value) => value.toUpperCase();
    }

    static toDate() {
        return (value) => new Date(value);
    }

}
module.exports = Str;