/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const Parser = require('../routing/Parser');
const Client = require('./Client');
const Url = require('url');

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
 * @constructor
 * @param {RestNio} restnio
 * @param {request} request
 * @param {response} response
 */
class HttpClient extends Client {

    constructor(restnio, request, response) {
        super('http');
        this.request = request;
        this.url = Url.parse(request.url, true);;
        this.response = response;
        this.tokenCheck(restnio);
        this.doRoute(restnio);
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

    err(err, code = 500) {
        super.err(err, code);
        this.response.statusCode = code;
        this.response.write(code + ' - ' + err.toString());
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

    // HTTP ONLY! sets a header in the response.
    header(header, value) {
        super.header(header, value);
        this.response.setHeader(header, value);
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
        if (token) {
            this.grantPermWithToken(token, restnio);
        }
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