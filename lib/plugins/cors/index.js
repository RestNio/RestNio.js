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
 * @class Cors
 * @classdesc
 * Add CORS support to certain paths or resources.
 */
module.exports = (options) => (router) => {
    options = _.defaultsDeep(options, defaults);

    // Simple CORS (For get post and head requests)
    router.httpAll('/*', { isActive: false, func: (params, client) => {
       client.header('access-control-allow-origin', options.origin); 
    }}, ['GET', 'POST', 'HEAD']);

    // Pre-Flight CORS (For special cases)
    router.httpOptions('/*', { isActive: true, func: (params, client) => {
        client.header('access-control-allow-origin', '*');
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