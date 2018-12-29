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
        this.signOptions = securiry.signOptions;
        this.verifyOptions = security.verifyOptions;
    }

    signToken(payload) {
        return new Promise((resolve, reject) => {
            JWT.sign(payload, this.privateKey, this.jwtOptions, (err, token) => {
                if (err) reject(err);
                resolve(token);
            });
        });
    }

    verifyToken(token) {
        return new Promise((resolve, reject) => {
            JWT.verify(token, this.publicKey, this.jwtOptions, (err, token) => {
                if (err) reject(err);
                resolve(token);
            });
        });
    }

}
module.exports = Token;