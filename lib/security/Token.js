/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const JWT = require('jsonwebtoken');

// Constants

/**
 * @class Token
 * @author 7kasper
 * @classdesc
 * TOKEN
 */
class Token {

    constructor(security) {
        if (security.secret) {
            this.privateKey = security.secret;
            this.publicKey = security.secret;
        } else {
            this.privateKey = security.privateKey;
            this.publicKey = security.publicKey;
        }
        this.defaultSignOptions = security.signOptions;
        this.defaultVerifyOptions = security.verifyOptions;
    }

    grant(permissions, signOptions = this.defaultSignOptions) {
        return this.sign({permissions: permissions});
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