/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const Router = require('./Router');

/**
 * @class RestNio
 * @classdesc
 * Server driver for a REST and websocket interface.
 * @constructor
 * @param {int} port the port for the server to bind on.
 * @param {security} security security settings to use.
 * @param {url} path the relative path to check requests at.
 */
function RestNio(port, security, router, path = '') {
    let restnio = {
        version: require('../package.json').version,
        port: port,
        security: security,
        path: path,
        routes: new Map(),
        // Websocket caches:
        subscriptions: {}
    };
    // Initialise the main router.
    router(new Router(restnio, path));
    return restnio;
}

exports = module.exports = RestNio;
exports.Router = Router;