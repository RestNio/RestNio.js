/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const QS = require('qs');

// Consts
const keywords = {
    true: true,
    false: false,
    null: null,
    undefined: undefined,
};

class Parser {

    static parseFullHttpParams(request, url) {
        return new Promise((resolve, reject) => {
            switch(request.method) {
                case 'POST':
                case 'PUT': {
                    let data = [];
                    request.on('data', (chunk) => {
                        data.push(chunk);
                    }).on('end', () => {
                        resolve(Parser.parseQueryStringParams(Buffer.concat(data).toString()));
                    });
                    break;
                }
                default: {
                    resolve(Parser.parseQueryStringParams(url.search));
                    break;
                }
            }
        });
    }

    static parseFullWsParams(request, callback) {
        return new Promise((resolve, reject) => {
            let params = request.params ? request.params : [];
            resolve(params);
        });
    }

    static parseQueryStringParams(string) {
        return QS.parse(string, {
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
                // Parse booleans, null and undifined.
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