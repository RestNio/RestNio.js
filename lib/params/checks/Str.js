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

// Regex check function:
let regCheck = (regex, valuetype='string') => (value, name) => {
    if (!(regex instanceof RegExp)) {
        regex = new RegExp(`^${regex}$`);
    }
    if (!regex.test(value)) {
        throw [400, `Invalid ${valuetype} (${value}) specified for ${name}!`]
    }
}

/**
 * @typedef StrCheck
 * @property {(regex: (RegExp|string), valuetype:string) => ParamCheck} regex - Checks whether the string is conform a certain regex. Gives nice error.
 * @property {() => ParamCheck} email - Checks whether the string is a valid email-adress.
 * @property {() => ParamCheck} uuid - Checks whether the string is a valid UUID.
 * @property {() => ParamCheck} time - Checks whether the string is a valid time string.
 * @property {(max: number) => ParamCheck} max - Checks whether the string is less than or equal the max length specified.
 * @property {(min: number) => ParamCheck} min - Checks whether the string is greater than or equal the min length specified.
 * @property {(from: number, to: number) => ParamCheck} range - Checks whether the string has a length between the range specifid.
 * Range is from from (inclusive) up to to (exclusive).
 */

module.exports = {
    regex: regCheck,
    email: () => regCheck(emailRegex, 'email'),
    uuid: () => regCheck(uuidRegex, 'uuid'),
    time: () => regCheck(timeRegex, 'time'),
    max: (max) => (value) => value.length <= max,
    min: (min) => (value) => value.length >= min,
    range: (from, to) => (value) => value.length >= from && value.length < to,
}