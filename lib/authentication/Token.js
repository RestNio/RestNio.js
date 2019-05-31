/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');
const JWT = require('jsonwebtoken');
/**
 * Type imports
 * @typedef {import("../util/Options").AuthOptions} AuthOptions
 * @typedef {import("../util/Options").AuthSignOptions} AuthSignOptions
 * @typedef {import("../util/Options").AuthVerifyOptions} AuthVerifyOptions
 */

/**
 * @exports Token
 * @class Token
 * @author 7kasper
 * @classdesc
 * Class that servers token authentication.
 * This is an authentication implementation
 * of the JWT authentication type.
 */
class Token {

    /**
     * Creates a token instance that can be used
     * to quickly sign and verify tokens.
     * @param {AuthOptions} auth - the authoptions
     * that specify how the JWT should be signed and verified. 
     */
    constructor(auth) {
        // Choose whether we should have simple passkey or keypair.
        if (auth.secret) {
            this.privateKey = auth.secret;
            this.publicKey = auth.secret;
        } else {
            this.privateKey = auth.privateKey;
            this.publicKey = auth.publicKey;
        }
        this.defaultSignOptions = auth.sign;
        this.defaultVerifyOptions = auth.verify;
        // Set algorithm to be same everywhere.
        this.defaultSignOptions.algorithm = auth.algorithm;
        this.defaultVerifyOptions.algorithms = [auth.algorithm];
    }

    /**
     * Creates a token with a set of permissions.
     * @param {string[]} permissions - the permissions to grant in this token.
     * @param {AuthSignOptions} [signOptions] - the signOptions, in format of the `JWT`
     * extenstion. Regerts to default sign options. 
     */
    grant(permissions, signOptions) {
        return this.sign({permissions: permissions}, signOptions);
    }

    /**
     * Creates a token with a certain payload.
     * @param {Object} payload - the payload to encompass in the token.
     * @param {AuthSignOptions} [signOptions] - the signOptions, in format of the `JWT`
     * extenstion. Regerts to default sign options. 
     */
    sign(payload, signOptions) {
        signOptions = _.defaultsDeep(signOptions, this.defaultSignOptions);
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
     * @param {AuthVerifyOptions} verifyOptions 
     */
    verify(token, verifyOptions) {
        verifyOptions = _.defaultsDeep(verifyOptions, this.defaultVerifyOptions);
        return new Promise((resolve, reject) => {
            JWT.verify(token, this.publicKey, verifyOptions, (err, token) => {
                if (err) reject(err);
                resolve(token);
            });
        });
    }

}
module.exports = Token;