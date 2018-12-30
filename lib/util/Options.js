/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Constants
const restnioDefaultOptions = {
    path: '',
    port: 80,
    http: {
        enabled: true
    },
    websocket: {
        enabled: true,
        forceToken: false,
        motd: 'Connected!',
        addUpgradeRoute: true
    },
    auth: {
        type: 'jwt',
        algorithm: 'HS256',
        secret: 'dogshite',
        sign: {
            expiresIn: '1h',
            issuer: 'RestNio'
        },
        verify: {
            issuer: ['RestNio', '7kasper']
        }
    }
};

class Options {

    /**
     * Makes an option object properly filled.
     * Without overriding this function fills
     * an options object's missing options with
     * the default options of RestNio. This way
     * we don't have to perform null checks etc
     * later on.
     * @param {*} options 
     * @param {*} defaultOptions 
     */
    static optionate(options, defaultOptions = restnioDefaultOptions) {
        if (options === undefined) options = {};
        for (let optionKey in defaultOptions) {
            if (typeof defaultOptions[optionKey] === 'object') {
                options[optionKey] = Options.optionate(options[optionKey], defaultOptions[optionKey]);
            } else {
                if (options[optionKey] === undefined) {
                    options[optionKey] = defaultOptions[optionKey];
                }
            }
        }
        return options;
    }

}
// Export default options for reference.
module.exports.defaultOptions = restnioDefaultOptions;
module.exports = Options;