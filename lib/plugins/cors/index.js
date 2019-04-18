/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

/**
 * @class Cors
 * @classdesc
 * Add CORS support to certain paths or resources.
 */
module.exports = () => (router, restnio) => {

    // Simple CORS (For get post and head requests)
    router.httpAll('/*', { func: (params, client) => {
       console.log(client.lastpath);
       client.header('Access-Control-Allow-Origin', '*'); 
    }}, ['GET', 'POST', 'HEAD']);

    // Pre-Flight CORS (For special cases)
    router.httpOptions('/*', {func: (params, client) => {
        client.header('Access-Control-Allow-Origin', '*');
        client.header('Access-Control-Allow-Credentials', 'true'); 
        client.header('Access-Control-Request-Method', client.request.method); 
        client.header('Access-Control-Allow-Headers', Object.keys(client.request.headers).join(', ')); 
    }});

}