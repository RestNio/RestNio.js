/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

//const Route = require('./Route');

/**
 * @class Router
 * @classdesc
 * Represents a router. A router is an easy way to add
 * routes to the restnio's routing map.
 * @constructor
 * @param {RestNio} rnio the restnio object to bind on.
 * @param {string} path the relative path to work on.
 */
class Client {

    constructor(type) {
        this.type = type;
    }

    transform(obj) {

    }

    sendFull(str) {
        console.log('-> ' + str)
    }

}

class HttpClient extends Client {

    constructor(ws) {
        super('WS');
    }

}

class WSClient extends Client {

    constructor(request, response) {
        super('HTTP');
        this.request = request;
        this.response = response;
    }

}

module.exports = Client;
module.exports.HttpClient = HttpClient;
module.exports.WSClient = WSClient;