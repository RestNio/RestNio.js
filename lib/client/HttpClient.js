/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');
const Parser = require('../routing/Parser');
const Client = require('./Client');
const Url = require('url');
/**
 * Typedef Imports
 * @typedef {import("../RestNio")} RestNio
 * @typedef {import("./Client")} Client
 * @typedef {import("../util/Options").ClientProperties} ClientProperties
 */

/**
 * @class HttpClient
 * @extends Client
 * @author 7kasper
 * @classdesc
 * A http client is backed by a request and response
 * object. A http client differs from websocket client
 * as it is restfull. All information required to do
 * something is contained in our single request.
 * We can also only handle one route and response with
 * this client, as any (full) response will close the
 * http connection.
 */
class HttpClient extends Client {

    /**
     * Makes a new HttpClient
     * Note that a client is handled restly
     * and thus for each HTTP request there
     * exists one client.
     * @param {RestNio} restnio
     * @param {request} request
     * @param {response} response
     * @param {ClientProperties} [props] - optional extra client properties.
     */
    constructor(restnio, request, response, props = {}) {
        super('http', restnio, _.defaultsDeep(props, 
            restnio.options.default.httpProperties));
        this.request = request;
        this.url = Url.parse(request.url, true);;
        this.response = response;
        this.cookies = {};
        this.parseCookies(restnio);
        this.tokenCheck(restnio);
        this.doRoute(restnio);
        if (this.header('content-type') === 'application/json') {
            this.props.jsonResponse = true;
        }
        this.cookieOptions = restnio.options.default.cookieOptions;
    }

    //=====================================================\\
    //				       Communications	       	   	   \\
    //=====================================================\\

    ok() {
        super.ok();
        // Http connection closes after each request.
        this.close();
    }

    str(str) {
        super.str(str);
        this.response.writeHead(200); //TODO CHECK
        this.response.write(str);
        this.close();
    }

    buf(buf) {
        super.buf(buf);
        this.response.writeHead(200);
        this.response.write(buf, 'binary');
        this.close();
    }

    err(err, code = 500) {
        super.err(err, code);
        this.response.statusCode = code;
        if (this.props.jsonError) {
            this.response.write(JSON.stringify({
                code: code,
                error: err
            }));
        } else {
            this.response.write(code + ' - ' + err.toString());
        }
        this.close();
    }

    redirect(url, code = 302) {
        this.response.writeHead(code, {Location: url});
        this.close();
    }

    close() {
        super.close();
        this.response.end();
    }

    header(header, value) {
        super.header(header, value);
        if (value !== undefined) {
            this.response.setHeader(header, value);
        } else {
            return this.request.getHeader(header);
        }
    }

    cookie(name, value, options) {
        super.cookie(name, value);
        if (value !== undefined) {
            let cookiestr = `${name}=${value}`;
            options = _.defaultsDeep(options, this.cookieOptions);
            if (options) {
                if (options.expires) cookiestr += `; Expires=${options.expires.toUTCString()}`;
                if (options.maxAge) cookiestr += `; Max-Age=${options.maxAge}`;
                if (options.domain) cookiestr += `; Domain=${options.domain}`;
                if (options.path) cookiestr += `; Path=${options.path}`;
                if (options.secure) cookiestr += `; Secure`;
                if (options.httpOnly) cookiestr += `; HttpOnly`;
                if (options.sameSite) cookiestr += `; SameSite=${options.sameSite}`;
            }
            this.header('set-cookie', cookiestr)
        } else {
            return this.cookies[name];
        }
    }

    //=====================================================\\
    //				            Setup	        	   	   \\
    //=====================================================\\

    /**
     * Performs the tokencheck from header if present.
     * Unlike websockets which can be upgraded
     * http connections are RESTfull and
     * verified via token for each request.
     * @param {RestNio} restnio 
     */
    tokenCheck(restnio) {
        let token = this.request.headers.token;
        if (token && restnio.options.auth.type == 'jwt') {
            this.grantPermWithToken(token, restnio);
        }
    }

    /**
     * Parses all cookies.
     * @param {RestNio} restnio 
     */
    parseCookies(restnio) {
        let sc = request.headers.cookies;
        sc && sc.split(';').forEach(cookie => {
            cookieparts = cookie.split('=');
            this.cookies[cookieparts[0]] = cookieparts[1];
        });
    }

    /**
     * Finds and runs the routing from request body.
     * @param {RestNio} restnio 
     */
    doRoute(restnio) {
        let routename = 'HTTP:' + this.request.method + ':' + this.url.pathname;
        this.run(routename, restnio.routes, 
            Parser.parseFullHttpParams, this.request, this.url);
    }

}
module.exports = HttpClient;