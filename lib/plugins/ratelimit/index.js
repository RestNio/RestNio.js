/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');
const Router = require('../../routes/Router');
const { path } = require('../../util/Options');
const ms = require('ms');
/**
 * @typedef {import("../../routes/Route").RouteFunc} RouteFunc
 */

/**
 * @typedef RateLimitOptions
 * @property {('address' | 'route' | 'socket' | 'params')} [per] - Per what instance is the request rate limited?
 * 'address' > (Default) requests are limited if the limit is reached for a certain internet adress.
 * 'route' > requests are limited for everyone using the route (function).
 * 'socket' > requests are limited per client. Note that, this only works for websockets.
 * 'param' > requests are limited per usage of param or list of params.
 * @property {String[]} [perParams] - List of paramnames when using param per.
 * @property {RouteFunc} [customPer] - Custom route function that gathers the per.
 * @property {('hard' | 'soft')} [scope] - Whether the scope applies hard or soft.
 * 'hard' > (Default) each request within the scope per given [per] counts to the limit.
 * 'soft' > Only requests that have the exact same path within the given route count towards the limit.
 * @property {(number | RouteFunc)} [limit] - What the actual rate limit is. Default is 10 (per minute)
 * @property {String} [time] - In what time the rate is limited. Default is one minute.
 * String represents the zeit/ms string to use. (Eg 1h for an hourly rate limit).
 * @property {(String | Object)} [message] - Message to show when the rate limit is exceded.
 * Default: 'Rate limit exceded!'
 * @property {number} [code] - HTTP error code when rate limit is exceded. Defaults to 429.
 * @property {boolean} [headers] - Wether to send (standard) HTTP headers with 
 * info about the rate limit. Defaults to true.
 * @property {RouteFunc} [skip] - Route function that skips the rate if returned true.
 * @property {boolean} [skipOnMissingParams] - If params specified in perParams are not present skip on default.
 * Note this is overrided if custon skip function is defined.
 */

/**
 * @callback RateLimit
 * @param {RateLimitOptions} options - The Rate Limit options to use. Will be filled in with defaults.
 * @returns {import("../../routes/Router").RouteBack} the plugin router (to be used).
 */

// Default options:
const defaults = {
    per: 'address',
    perParams: [],
    skipOnMissingParams: true,
    scope: 'hard',
    limit: 10,
    time: '1m',
    message: 'Rate limit exceded!',
    code: 429,
    headers: true
}

/**
 * CORS plugin to allow easy Cross-Origin-Resource-Sharing.
 * @type {RateLimit}
 */
module.exports = (options) => (router) => {
    options = _.defaultsDeep(options, defaults);
    // Use moment.js to get millisecond window.
    let window = ms(options.time);
    let calculateTimeToReset = () => new Date(Date.now() + window);
    // Setup main rate map.
    let RateMap = new Map();
    let timeToReset = calculateTimeToReset();
    let resetRateMap = () => {
        RateMap.clear();
        timeToReset = calculateTimeToReset();
    };
    const RateInterval = setInterval(resetRateMap, window);
    if (RateInterval.unref) {
        RateInterval.unref();
    }
    // Setup function to get the current count towards the rate.
    let getCount = (per) => {
        return RateMap.get(per) || 0;
    };
    // Setup function to add to the rate count.
    let rateUp = (per) => {
        RateMap.set(per, (RateMap.get(per) || 0) + 1);
    }
    // If using a soft scope, alter the functions to base around client path.
    if (options.scope == 'soft') {
        getCount = (per, pathUrl) => {
            let softMap = RateMap.get(pathUrl);
            if (!softMap) return 0;
            return softMap.get(per) || 0;
        }
        rateUp = (per, pathUrl) => {
            let softMap = RateMap.get(pathUrl);
            if (!softMap) {
                softMap = new Map();
                RateMap.set(pathUrl, softMap);
            }
            softMap.set(per, (softMap.get(per) || 0) + 1);
        }
    }
    // Setup per function.
    let getPer = options.customPer;
    if (!getPer) {
        switch(options.per) {
            case 'address': {
                getPer = (params, client) => client.ip;
                break;
            }
            case 'route': {
                getPer = (params, client) => client.lastroute;
                break;
            }
            case 'socket': {
                throw 'Not implemented yet!';
            }
            case 'params': {
                getPer = (params) => {
                    let per = '';
                    for (let paramName of options.perParams) {
                        per += ':' + String(params[paramName]);
                    }
                    return per;
                }
            }
        }
    }
    let skip = options.skip;
    if (skip === undefined) {
        if (options.skipOnMissingParams) {
            skip = (params) => {
                for (let paramName of options.perParams) {
                    if (params[paramName] === undefined) return true;
                }
                return false;
            }
        } else {
            skip = () => false;
        }
    }
    // Setup limit function.
    let getLimit = options.limit;
    if (typeof options.limit == 'number') {
        getLimit = () => options.limit;
    }
    // Register the actual rate limiter.
    router.all('', {isActive: false, func: async (params, client) => {
        if (await skip(params, client)) return;
        let per = await getPer(params, client);
        let count = getCount(per, client.lastroute);
        let limit = await getLimit(params, client);
        console.log(`Rate limit? - ${per} - ${limit} - ${count}`);
        if (options.headers) {
            client.header('x-ratelimit-limit', limit);
            client.header('x-ratelimit-remaining', Math.max(limit-count, 0));
            client.header('date', new Date().toGMTString());
            client.header('x-ratelimit-reset', Math.ceil(timeToReset.getTime()/1000));
        }
        if (count > limit) {
            if (options.headers) client.header('retry-after', Math.ceil(window/1000));
            throw [options.code, options.message];
        } else {
            rateUp(per, client.lastroute);
        }
    }});

}