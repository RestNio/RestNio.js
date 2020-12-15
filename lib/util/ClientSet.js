/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');
/**
 * Typedef Imports
 * @typedef {import("../client/Client")} Client
 */

/**
 * @exports ClientSet
 * @class ClientSet
 * @extends Set<Client>
 * @author 7kasper
 * @classdesc
 * Special set implementation for clients.
 * Allows the same communication functions for clients but on an entire set.
 */
class ClientSet extends Set {

    //=====================================================\\
    //				       Communications	       	   	   \\
    //=====================================================\\

	/**
	 * Ok's a client. An ok is a typical response if a route was executed
	 * but doesn't really return something. Websockets stay open on ok,
	 * but the http implementation closes with a blank 200 status.
	 */
    ok() {
        this.forEach(client => client.ok());
    }

	/**
	 * Sends an object to the client.
	 * Strings will not be encoded, other objects
	 * will be send as JSON strings.
     * @param {?} obj - The object to send.
	 */
    obj(obj) {
        this.forEach(client => client.obj(obj));
    }

	/**
	 * Send all arguments specified with JSON encoding.
	 */
    json(...args) {
        this.forEach(client => client.json(...args));
    }

	/**
	 * Sends a plain string to the client.
     * @param {string} str
	 */
    str(str) {
        this.forEach(client => client.str(str));
    }

    /**
     * Sends a buffer to the client. (Raw Bytes)
     * @param {Buffer} buf 
     */
    buf(buf) {
        this.forEach(client => client.buf(buf));
    }

	/**
	 * Sends an error + statuscode to the client.
	 */
    err(err, code) {
        this.forEach(client => client.err(err, code));
    }

    /**
     * Throws an client error in the neat way.
     */
    throwErr(err) {
        if (Array.isArray(err) && err.length > 1) this.err(err[1], err[0]);
        else this.err(err);
    }

	/**
	 * Closes the connection with a client.
	*/
    close() {
        this.forEach(client => client.close());
    }

    /**
     * Get or set a header property.
     * NOTE: CURRENTLY ONLY HTTP SUPPORT
     * @param {string} header - the header name to get / set.
     * @param {string} [value] - if specified the value to set in the header.
     */
    header(header, value) {
        this.forEach(client(header, value));
    }

    /**
     * Get or set a cookie :)
     * NOTE: CURRENTLY ONLY HTTP SUPPORT
     * @param {string} name - the name of the cookie to get / set.
     * @param {any} [value] - if specified, the value to set the cookie to.
     * @param {CookieOptions} [options] - if specified the cookie options.
     */
    cookie(name, value, options) {
        this.forEach(this.cookie(name, value, options));
    }

}
module.exports = ClientSet;