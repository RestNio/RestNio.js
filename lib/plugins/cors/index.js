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

/**
 * @typedef CorsOptions
 * @property {String} [origin='*'] - What origin to allow CORS from (or '*' for all).
 * @property {boolean} [allowCredentials=true] - Whether or not to allow credentials from other source.
 * @property {boolean} [preflight=true] - Whether to support pre-flight CORS for more complex methods.
 * @property {String} [methods] - What HTTP methods to support (Defaults to all valid http methods)
 * @property {String} [headers='*'] - What http headers to allow (or '*' for all).
 * @property {Number} [maxAge=86400] - Maximum age for pre-flight response for browser.  
 */

/**
 * @callback Cors
 * @param {CorsOptions} options - The CORS options to use. Will be filled in with defaults.
 * @returns {import("../../routes/Router").RouteBack} the plugin router (to be used).
 */

// Default options:
const defaults = {
    origin: '*', 
    allowCredentials: true, 
    preflight: true,
    methods: Router.allHttpMethods.join(', '),
    headers: '*',
    maxAge: 86400
}

/**
 * CORS plugin to allow easy Cross-Origin-Resource-Sharing.
 * @type {Cors}
 */
module.exports = (options) => (router) => {
    options = _.defaultsDeep(options, defaults);

    // Simple CORS (For get post and head requests)
    router.httpAll('/*', { isActive: false, func: (params, client) => {
       client.header('access-control-allow-origin', options.origin); 
    }}, ['GET', 'POST', 'HEAD']);

    if (options.preflight) {
        // Pre-Flight CORS (For special cases)
        router.httpOptions('/*', { isActive: true, func: (params, client) => {
            client.header('access-control-allow-origin', options.origin);
            client.header('access-control-allow-credentials', options.allowCredentials); 
            client.header('access-control-request-method', options.methods); 
            let allowedHeaders = options.headers;
            if (allowedHeaders === '*' && client.request.headers['access-control-request-headers']) {
                allowedHeaders = client.request.headers['access-control-request-headers'];
            }
            client.header('access-control-allow-headers', allowedHeaders);
            if (options.maxAge) client.header('access-control-max-age', options.maxAge);
        }});
    }

}