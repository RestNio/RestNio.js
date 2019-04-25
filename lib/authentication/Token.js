/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const JWT = require('jsonwebtoken');

/**
 * @class Token
 * @author 7kasper
 * @classdesc
 * Class that servers token authentication.
 */
class Token {

    constructor(auth) {
        if (auth.secret) {
            this.privateKey = auth.secret;
            this.publicKey = auth.secret;
        } else {
            this.privateKey = auth.privateKey;
            this.publicKey = auth.publicKey;
        }
        this.defaultSignOptions = auth.signOptions;
        this.defaultVerifyOptions = auth.verifyOptions;
    }

    /**
     * Creates a token with a set of permissions.
     * @param {string[]} permissions - the permissions to grant in this token.
     * @param {Object} [signOptions] - the signOptions, in format of the `JWT`
     * extenstion. Regerts to default sign options. 
     */
    grant(permissions, signOptions = this.defaultSignOptions) {
        return this.sign({permissions: permissions}, signOptions);
    }

    /**
     * Creates a token with a certain payload.
     * @param {Object} payload - the payload to encompass in the token.
     * @param {Object} [signOptions] - the signOptions, in format of the `JWT`
     * extenstion. Regerts to default sign options. 
     */
    sign(payload, signOptions = this.defaultSignOptions) {
        return new Promise((resolve, reject) => {
            JWT.sign(payload, this.privateKey, signOptions, (err, token) => {
                if (err) reject(err);
                resolve(token);
            });
        });
    }

    /**
     * Checks if a given token is signed by us and still valid according to the verify options.
     * @param {Object} token - the token to check. 
     * @param {*} verifyOptions 
     */
    verify(token, verifyOptions = this.defaultVerifyOptions) {
        return new Promise((resolve, reject) => {
            JWT.verify(token, this.publicKey, verifyOptions, (err, token) => {
                if (err) reject(err);
                resolve(token);
            });
        });
    }

}
module.exports = Token;