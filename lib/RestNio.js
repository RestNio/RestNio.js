/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

/**
 * @class RestNio
 * @classdesc
 * Server driver for a REST and websocket interface.
 * @constructor
 * @param {int} port the port for the server to bind on.
 * @param {security} security security settings to use.
 * @param {url} path the relative path to check requests at.
 */
function RestNio(port, security, path = '') {
    let restnio = {
        version: require('../package.json').version,
        port: port,
        security: security,
        path: path,
        // Websocket caches:
        subscriptions: {}
    };
    return restnio;
}
module.exports = RestNio;