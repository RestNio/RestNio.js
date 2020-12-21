/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const _ = require('lodash');
const WebSocket = require('ws');

/**
 * Ws Callback
 * @callback wsCallback
 * @param {*} data - Data on message.
 * @param {*} client - Reference to the websocket.
 * @returns {*} - optional response data.
 */

/**
 * Creates a websocket. (Currently: JSON only)
 * @param {string} url - The url to create a websocket connection on.
 * @param {wsCallback} [onMessage] - Callback with data from a message.
 * @param {wsCallback} [onConnect] - Callback on connect.
 * @param {wsCallback} [onClose] - Callback on close or timeout.
 * @param {wsCallback} [onError] - Callback on error.
 * @returns {WebSocket} - the websocket as object.
 */
module.exports = (
        url, 
        onMessage = () => {}, 
        onConnect = () => {}, 
        onClose = () => {}, 
        onError = () => {}, 
        timeout = 60000, 
        clientTimeoutExtra = 1000
    ) => {
    let heartBeat = function() {
        clearTimeout(this.pingTimeout);
        this.pingTimeout = setTimeout(() => {
            console.log('wtf timeout');
            this.terminate();
        }, timeout + clientTimeoutExtra);
    }
    const client = new WebSocket(url);
    // Extra functions like in restnio clients
    client.obj = (obj) => {
        if (typeof obj === 'string') {
            client.send(obj);
        } else if (Buffer.isBuffer(obj)) {
            client.send(obj);
        } else {
            client.send(JSON.stringify(obj));
        }
    }
    // Default Event Handlers
    client.on('open', function open() {
        heartBeat.call(this);
        onConnect({}, client);
    });
    client.on('ping', function ping () {
        heartBeat.call(this);
        console.log('GOT PING');
    });
    client.on('close', function clear() {
        clearTimeout(this.pingTimeout);
        onClose({}, client);
    });
    client.on('error', function error(error) {
        onError(error, client);
    })
    client.on('message', function incoming(data) {
        onMessage(JSON.parse(data), client);
    });
    return client;
}