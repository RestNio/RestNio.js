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

    constructor(type, permissions = [], info = {}) {
        this.type = type;
        this.permissions = new Set(permissions);
        this.info = new Map(Object.entries(info));
    }

    upgrade(...args) {
        //BREAK
    }

    upgradePerms(perms) {
        this.permissions.push(...perms);
    }

    obj(obj) {
        if (typeof obj === 'string') {
            this.str(obj);
        } else {
            this.str(JSON.stringify(obj));
        }
    }

    json(...args) {
        this.str(JSON.stringify(...args));
    }

    str(str) {
        console.log('-> ' + str);
    }

    err(err, code) {
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

    str(str) {
        super.str(str);
        this.ws.send(str);
    }

    err(err, code = 500) {
        super.err(err, code);
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
        this.upgrade(request.headers);
    }

    str(str) {
        super.str(str);
        this.response.end(str);
    }

    err(err, code = 500) {
        super.err(err, code);
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