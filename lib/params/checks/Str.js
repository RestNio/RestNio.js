/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

/**
 * @typedef {import("../../routes/Route").ParamCheck} ParamCheck
 */

// Prepare accurate Email regex. (Thanks to the Chromium project!)
const emailRegex = new RegExp([
    '^(([^<>()[\\]\\\.,;:\\s@\"]+(\\.[^<>()\\[\\]\\\.,;:\\s@\"]+)*)',
    '|(".+"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.',
    '[0-9]{1,3}\])|(([a-zA-Z\\-0-9]+\\.)+',
    '[a-zA-Z]{2,}))$'
].join(''));

/**
 * @typedef StrCheck
 * @property {() => ParamCheck} email - Checks whether the string is a valid email-adress.
 */
module.exports = {
    email: () => (value, name, reject) => {
        if (!emailRegex.test(value)) {
            reject('Invalid email (' + value + ') specified for ' + name + '!');
        }
    }
}