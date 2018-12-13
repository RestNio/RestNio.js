/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

/**
 * @class Client
 * @classdesc
 * Represents a client. 
 * A client is either a http endpoint or websocket connection.
 * Clients share common functions so the routings can be interchangable.
 * @constructor
 * @param {String} type the restnio object to bind on.
 */
class Client {

    constructor(type) {
        this.type = type;
    }

    pushVar(obj) {
        if (typeof obj === 'string') {
            this.sendFullString(obj);
        } else {
            this.sendFullString(JSON.stringify(obj));
        }
    }

    sendFullString(str) {
        console.log('-> ' + str);
    }

    sendFullError(err, code) {
        console.error('-> ' + code + ' - ' + err);
    }

    close() {
        console.log('Closed Client');
    }

}

class WSClient extends Client {

    constructor(ws) {
        super('ws');
        this.ws = ws;
    }

    sendFullString(str) {
        super.sendFullString(str);
        this.ws.send(str);
    }

    sendFullError(err, code = 500) {
        super.sendFullError(err, code);
        this.ws.send(JSON.stringify(err));
    }

    close() {
        super.close();
        this.ws.terminate();
    }

}

class HttpClient extends Client {

    constructor(request, url, response) {
        super('http');
        this.request = request;
        this.url = url;
        this.response = response;
    }

    sendFullString(str) {
        super.sendFullString(str);
        this.response.end(str);
    }

    sendFullError(err, code = 500) {
        super.sendFullError(err, code);
        this.response.statusCode = code;
        this.response.end(code + ' - ' + err.toString());
    }

    close() {
        super.close();
        this.response.end();
    }

}

module.exports = Client;
module.exports.http = HttpClient;
module.exports.ws = WSClient;