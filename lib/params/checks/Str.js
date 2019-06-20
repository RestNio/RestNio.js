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
// Prepare accurate UUID regex. (Thanks to RFC4122!)
const uuidRegex = /^{?([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})}?$/i
// Prepare time regex.
const timeRegex = /^[0-9]{1,2}:[0-9]{1,2}(?::[0-9]{1,2})?$/

/**
 * @typedef StrCheck
 * @property {() => ParamCheck} email - Checks whether the string is a valid email-adress.
 * @property {() => ParamCheck} uuid - Checks whether the string is a valid UUID.
 * @property {() => ParamCheck} time - Checks whether the string is a valid time string.
 */

module.exports = {
    email: () => (value, name) => {
        if (!emailRegex.test(value)) {
            throw [400, `Invalid email (${value}) specified for ${name}!`];
        }
    },
    uuid: () => (value, name) => {
        if (!uuidRegex.test(value)) {
            throw [400, `Invalid uuid (${value}) specified for ${name}!`];
        }
    },
    time: () => (value, name) => {
        if (!timeRegex.test(value)) {
            throw [400, `Invalid time (${value}) specified for ${name}!`];
        }
    }
}