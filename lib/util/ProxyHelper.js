/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require("lodash");
const { head } = require("lodash");

/**
 * @typedef {import("../../index").RestNio} RestNio
 * @typedef {import("../../index").ProxyOptions} ProxyOptions
 * @typedef {import("../../index").Client} Client
 */

// Helper vars
// Thanks to JGsoft RegexBuddy library.
const ipv4Pattern = new RegExp('\\b' +
'(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.' +
'(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.' +
'(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.' +
'(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)' +
'\\b');
// Thanks to https://stackoverflow.com/questions/32368008/regular-expression-that-matches-all-valid-format-ipv6-addresses
const ipv6Pattern = new RegExp(
    '(?:^|(?<=\\s))(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:)' + 
    '{1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:)' + 
    '{1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:)' + 
    '{1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)' + 
    '|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:)' + 
    '{0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:)' + 
    '{1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))(?=\\s|$)'    
);

/**
 * Helps with some proxy stuff.
 */
module.exports = {

    /**
     * Some nice defaults to get IP.
     * Executed top down in order in order to get client ip.
     */
    defaultIpHeaderGrabbers: [
        (headers) => headers['x-client-ip'],
        (headers) => {
            let xforward = headers['x-forwarded-for'];
            if (xforward && typeof xforward == 'string') {
                // Thnx to request-ip by pboojinov.
                // Weird xforward header :F
                let ip = xforward.split(',')[0];
                if (ip.includes(':')) {
                    // Some services have ipv4, others ipv6, others ipv4:port
                    let splitted = ip.split(':');
                    if (splitted.length === 2) return splitted[0];
                }
                return ip;
            }
            return null;
        },
        (headers) => headers['x-real-ip'],
        (headers) => headers['true-client-ip'],
        (headers) => headers['cf-connecting-ip'],
        (headers) => headers['fastly-client-ip'],
        (headers) => headers['x-forwarded'],
        (headers) => headers['x-cluster-client-ip'],
        (headers) => headers['forwarded-for'],
 
    ],

    defaultIpNetworkGrabbers: [
        (req) => { 
            if (req.connection) {
                return req.connection.remoteAdress;
            }
        }, (req) => { 
            if (req.connection) {
                return req.connection.remoteAdress;
            }
        }, (req) => {
            if (req.connection && req.connection.soket) {
                return req.connection.socket.remoteAdress;
            }
        }, (req) => {
            if (req.socket) {
                return req.socket.remoteAdress;
            }
        }, (req) => {
            if (req.info) {
                return req.info.remoteAdress;
            }
        }, (req) => {
            if (req.requestContext && req.requestContext.identity) {
                return req.requestContext.identity.sourceIp;
            }
        }, (req) => {
            if (req.headers.host) {
                // Last but not least check if localhost.
                // Note this may be spoofed, but my guess is you cannot spoof
                // this header without leaving trail in the network layer.
                // TODO: CHECK THAT!
                let hostname = req.headers.host.split(':')[0];
                if (hostname.trim() == 'localhost' || hostname.trim() == '127.0.0.1') {
                    return '127.0.0.1';
                }
            }
        }
    ],

    /**
     * Extract the ip from a HTTP request using specified options.
     * @param {RestNio} restnio - Reference to restnio instance for options.
     * @param {Client} client - Reference to the restnio client.
     * @param {ProxyOptions} [optOptions] - Optional options
     * @returns {string} - The extracted IP or null if not possible.
     * @throws Proxy not trusted, if the proxy is not trusted.
     */
    extractIp(restnio, client, optOptions = {}) {
        /**@type {ProxyOptions}*/ let options = _.defaultsDeep(optOptions, restnio.options.proxy);
        let headerIp = this.extractHeaderIp(client, options);
        // If we only trust certain proxies, check header functions.
        if (headerIp !== null && options.trustedProxies.length > 0) {
            networkIp = this.extractNetworkIp(client, options);
            if (options.trustedProxies.includes(networkIp)) {
                return headerIp;
            } else {
                throw [400, 'Proxy not trusted!'];
            }
        } else if (headerIp !== null) {
            return headerIp;
        } else {
            return this.extractNetworkIp(client, options);
        }
    },

    /**
     * Extract header (proxy) ip.
     * @param {Client} client 
     * @param {ProxyOptions} options
     * @returns {(string | null)} - The extracted ip or null.
     */
    extractHeaderIp(client, options) {
        for (let ipHeaderGrabber of options.ipHeaderGrabbers) {
            let attempt = ipHeaderGrabber(client.request.headers);
            if (this.isIp(attempt)) return attempt;
        }
        return null;
    },

    /**
     * Extract network ip.
     * @param {Client} client 
     * @param {ProxyOptions} options
     * @returns {(string | null)} - The extracted ip or null.
     */
    extractNetworkIp(client, options) {
        console.dir(client.request.hostname)
        for (let ipNetworkGrabber of options.ipNetworkGrabbers) {
            let attempt = ipNetworkGrabber(client.request);
            console.log(attempt);
            if (this.isIp(attempt)) return attempt.trim();
        }
        return null;
    },

    /**
     * Checks whether given adress is valid ipV4 or ipV6.
     * @param {string} adress - The ip adress
     * @returns {boolean} - wether the ip is valid or not.
     */
    isIp(address) {
        return this.isIpV4(address) || this.isIpV6(address);
    },

    /**
     * Checks whether given adress is valid ipV4.
     * @param {string} adress - The ip adress
     * @returns {boolean} - wether the ip is valid or not.
     */
    isIpV4(address) {
        return typeof address == 'string' && ipv4Pattern.test(address.trim());
    },

    /**
     * Checks whether given adress is valid ipV6.
     * @param {string} adress - The ip adress
     * @returns {boolean} - wether the ip is valid or not.
     */
    isIpV6(address) {
        return typeof address == 'string' && ipv6Pattern.test(address.trim());
    }

};