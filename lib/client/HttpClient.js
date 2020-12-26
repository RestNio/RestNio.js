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
const ms = require('ms');
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
     * @param {Request} request
     * @param {Response} response
     * @param {ClientProperties} [props] - optional extra client properties.
     */
    constructor(restnio, request, response, props = {}) {
        super('http', restnio, request, _.defaultsDeep(props, 
            restnio.options.default.httpProperties));
        this.url = Url.parse(request.url, true);
        this.response = response;
        if (this.header('content-type') === 'application/json') {
            this.props.jsonResponse = true;
            this.props.jsonError = true;
        }
        this.cookies = {};
        this.cookieOptions = restnio.options.default.cookieOptions;
        this.parseHeaderCookies(restnio);
        this.startBeat();
    }

    /**
     * Asyncly performs the startup of this client.
     */
    async startBeat() {
        await super.startBeat();
        try {
            await this.tokenCheck();
            await this.doRoute();
        } catch (err) {
            this.throwErr(err);
        }
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
        try { // In case sending error gives error catch it.
            this.response.statusCode = code;
            if (this.props.corsErrorOrigin) this.header('access-control-allow-origin', this.props.corsErrorOrigin);
            if (this.props.jsonError) {
                this.response.write(JSON.stringify({
                    code: code,
                    error: err.toString()
                }));
            } else {
                this.response.write(code + ' - ' + err.toString());
            }
        } catch (err) { console.error(err) }
        this.close();
    }

    redirect(url, code = 302) {
		// Write the redirect code and location to the http client.
		this.response.writeHead(code, {Location: url});
		// Force close the connection.
		this.close();
		// Return inifite. We don't want a 200 (OK) message to be send wrongly.
		return Infinity;
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
            return this.request.headers[header.toLowerCase()];
        }
    }

    cookie(name, value, options) {
        super.cookie(name, value);
        if (value !== undefined) {
            let cookiestr = `${name}=${value}`;
            options = _.defaultsDeep(options, this.cookieOptions);
            if (options) {
                if (options.expires) cookiestr += `; Expires=${options.expires.toUTCString()}`;
                if (typeof options.maxAge === 'number') cookiestr += `; Max-Age=${options.maxAge}`;
                else if (typeof options.maxAge === 'string') cookiestr += `; Max-Age=${ms(options.maxAge)}`;
                if (options.domain) cookiestr += `; Domain=${options.domain}`;
                if (options.path) cookiestr += `; Path=${options.path}`;
                if (options.secure) cookiestr += `; Secure`;
                if (options.httpOnly) cookiestr += `; HttpOnly`;
                if (options.sameSite) cookiestr += `; SameSite=${options.sameSite}`;
            }
            this.header('set-cookie', cookiestr);
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
     */
    async tokenCheck() {
        let token = this.headers.token;
        if (token && this.restnio.options.auth.type == 'jwt') {
            await this.grantPermWithToken(token);
        }
        // Try cached token. On fail, clear the cached token.
        if (!token && this.restnio.options.auth.cookietoken && 
            this.restnio.options.auth.type == 'jwt' && this.cookies.token) 
        {
            try { // TODO make silent behaviour configurable?
                await this.grantPermWithToken(this.cookies.token);
            } catch (e) {
                // Silently fail and delete the wrong token.
                // Note that an application can override this behaviour
                // by resending a token in the same request.
                this.clearCookie('token');
            }
        }
    }

    /**
     * Parses all headers and cookies from client.
     */
    parseHeaderCookies() {
        this.headers = this.request.headers;
        if (this.headers.cookie) {
            this.cookies = Parser.parseQueryStringParams(
                this.headers.cookie.replace(/\; ?/g, '&')
            );
        }
    }

    /**
     * Finds and runs the routing from request body.
     */
    doRoute() {
        let routename = 'HTTP:' + this.request.method + ':' + this.url.pathname;
        this.run(routename, this.restnio.routes, 
            Parser.parseFullHttpParams, this.request, this.url);
    }

}
module.exports = HttpClient;