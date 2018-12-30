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

    grant(permissions, signOptions = this.defaultSignOptions) {
        return this.sign({permissions: permissions}, signOptions);
    }

    sign(payload, signOptions = this.defaultSignOptions) {
        return new Promise((resolve, reject) => {
            JWT.sign(payload, this.privateKey, signOptions, (err, token) => {
                if (err) reject(err);
                resolve(token);
            });
        });
    }

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