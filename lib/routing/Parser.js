/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');
const QueryString = require('qs');

// Parse Constants
const keywords = {
    'true': true,
    'false': false,
    'null': null,
    'undefined': undefined,
};

/**
 * @exports Parser
 * @class Parser
 * @classdesc
 * Holds all utility functions to parse both
 * websocket and http parameters.
 */
class Parser {

    /**
     * Parses the parameters from a http request.
     * For POST and PUT requests the body is read first and
     * then decoded using the querystring method.
     * Parameters for all other requests should be contained
     * in the query itself by way of querystring parameters
     * and as such are decoded directly via the same method.
     * @param {HttpRequest} request - the http request
     * @param {string} url - the query-string containing url
     * @returns the entailed parameters.
     */
    static parseFullHttpParams(request, url) {
        return new Promise((resolve) => {
            let params = Parser.parseQueryStringParams(url.search);
            let data = [];
            request.on('data', (chunk) => {
                data.push(chunk);
            }).on('end', () => {
                let bodystring = Buffer.concat(data).toString();
                if (bodystring) {
                    if (request.headers['content-type'] === 'application/json') {
                        resolve(_.defaultsDeep(JSON.parse(bodystring), params));
                    } else if (request.headers['content-type'].includes('image')) {
                        resolve(_.defaultsDeep({imgdata: bodystring}, params));
                    } else {
                        resolve(_.defaultsDeep(Parser.parseQueryStringParams(bodystring), params));
                    }
                } else {
                    resolve(params);
                }
            });
        });
    }

    /**
     * Parses the full parameters from a websocket request.
     * (Websocket parameters are mostly handled by the JSON format),
     * This method currently just makes sure empty-param-requests
     * are handled correctly. It can be extended in the future.
     * @param {WebsocketRequest} request - the websocket request
     * @returns the entailed parameters.
     */
    static async parseFullWsParams(request) {
        return request.params ? request.params : [];
    }

    /**
     * Parse parameters from a querystring format.
     * 
     * Example: '?name=trudy&age=5&born=true'
     * will translate into:
     * {
     *   name: 'trudy',
     *   age: 5,
     *   born: true
     * }
     * @param {string} string - the querystring
     * @returns the entailed parameters.
     */
    static parseQueryStringParams(string) {
        return QueryString.parse(string, {
            ignoreQueryPrefix: true,
            decoder(str, decoder, charset) {
                const strWithoutPlus = str.replace(/\+/g, ' ');
                if (charset === 'iso-8859-1') {
                    return strWithoutPlus.replace(/%[0-9a-f]{2}/gi, unescape);
                }
                // Parse Numbers
                if (/^-?(\d+|\d*\.\d+)$/.test(str)) {
                    return parseFloat(str)
                }
                // Parse booleans, null and undefined.
                if (str in keywords) {
                    return keywords[str]
                }
                // utf-8
                try {
                    return decodeURIComponent(strWithoutPlus);
                } catch (e) {
                    return strWithoutPlus;
                }
            }
        });
    }

}
module.exports = Parser;