/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

class Num {

    static max(max) {
        return (value) => {
            return value <= max;
        }
    }

    static min(min) {
        return (value) => {
            return value >= min;
        }
    }

    static range(from, to) {
        return (value) => {
            return (value >= from && value < to);
        };
    }

}
module.exports = Num;