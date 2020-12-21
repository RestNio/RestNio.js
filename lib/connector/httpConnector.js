/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');
const Https = require('https');
const Http = require('http');
const QueryString = require('qs');
const Router = require('../routes/Router');

/**
 * @typedef httpClientRequest
 * @property {string} path - The (sub) path the request is performed on.
 * @property {Object} [params] - The parameters of the HTTP request.
 * @property {string} [token] - Optional token specific for the request.
 */

/**
 * Http Callback
 * @callback httpCallback
 * @param {*} body - The response (body).
 * @param {Request} res - The HTTP response.
 * @param {Request} req - The HTTP request.
 */

/**
 * Performs a HTTP request
 * @param {string} method - The method (GET, POST, PUT etc) to use.
 * @param {(string|Array)} url - the (valid) url to perform the request on.
 * @param {(Array|httpCallback)} [params] - parameters to use.
 * @param {(Array|httpCallback)} [headers] - (custom) headers to use. To specify only headers, pass empty params.
 * @param {httpCallback} callback - Callback with returned data.
 * @param {boolean} [json=true] - Whether to use JSON on body data requests.
 */
const singleHttp = (method, url, params, headers, callback, json) => {
    // If valid url is found for method, guess method is 'GET' an transform other parameters.
    if (!!Router.httpRegex.test(method)) {
        json = callback; callback = headers; headers = params; params = url; url = method;
        method = 'GET';
    } else { method = method.toUpperCase(); }
    // If no headers are specified than probably we dont want them.
    if (_.isFunction(headers) && !_.isFunction(callback)) {
        callback = headers; json = callback;
        headers = {};
    }
    // If no params are specified either than probably we dont want them.
    if (_.isFunction(params) && !_.isFunction(headers) && !_.isFunction(callback)) {
        callback = params; json = headers;
        headers = {}; params = {};
    }
    if (json === undefined) json = true;
    // Test if url is valid.
    if (!Router.httpRegex.test(url)) {
        throw `Invalid url (${url}) specified!`;
    }
    let {groups: urlsplit} = Router.httpRegex.exec(url);
    let options = {
        protocol: urlsplit.protocol,
        hostname: urlsplit.host,
        port: urlsplit.port,
        path: urlsplit.path,
        method: method,
        headers: headers
    }
    if (!options.path) options.path = '/';
    if (!options.port) options.port = options.protocol == 'https:' ? 443 : 80;
    let queryparams = QueryString.parse(urlsplit.params);
    let bodyparams = '';
    // In GET or non-json request only use query parameters.
    if (method == 'GET' || json == false) {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        if (method == 'GET') {
            queryparams = _.defaultsDeep({}, params, queryparams);
        } else {
            bodyparams = QueryString.stringify(params);
            options.headers['Content-Length'] = bodyparams.length;
        }
    } else {
        bodyparams = JSON.stringify(params);
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = bodyparams.length;
    }
    if (_.size(queryparams) > 0) options.path = `${options.path}?${QueryString.stringify(queryparams)}`;
    let dataIn = '';
    let request = options.protocol == 'https:' ? Https.request : Http.request;
    return new Promise((resolve, reject) => {
        const req = request(options, res => {
            resolve(res);
            res.on('data', chunk => dataIn += chunk);
            res.on('end', () => {res.bodyFull = dataIn; callback(dataIn, res);});
            res.on('error', err => reject(err));
        });
        if (method != 'GET') req.write(bodyparams);
        req.end();
    });
}

/**
 * @exports httpConnector
 * @class httpConnector
 * @classdesc
 * Http connector object to make restnio like requests with restnio.
 */
class httpConnector {

    /**
     * Creates a new httpConnector object.
     * @param {string} baseurl The base url for the methods.
     */
    constructor(baseurl, headers = {}, json = true) {
        this.baseurl = baseurl;
        this.headers = headers;
        this.json = json;
    }

    /**
     * Performs a http 'GET' request.
     * @param {httpClientRequest} req - The HTTP request (body) options.
     * @param {httpCallback} callback - The callback that gets called on response.
     */
    get(req, callback) {
        return this.request('GET', req, callback);
    }

    /**
     * Performs a http 'HEAD' request.
     * @param {httpClientRequest} req - The HTTP request (body) options.
     * @param {httpCallback} callback - The callback that gets called on response.
     */
    head(req, callback) {
        return this.request('HEAD', req, callback);
    }

    /**
     * Performs a http 'POST' request.
     * @param {httpClientRequest} req - The HTTP request (body) options.
     * @param {httpCallback} callback - The callback that gets called on response.
     */
    post(req, callback) {
        return this.request('POST', req, callback);
    }

    /**
     * Performs a http 'PUT' request.
     * @param {httpClientRequest} req - The HTTP request (body) options.
     * @param {httpCallback} callback - The callback that gets called on response.
     */
    put(req, callback) {
        return this.request('PUT', req, callback);
    }

    /**
     * Performs a http 'PATCH' request.
     * @param {httpClientRequest} req - The HTTP request (body) options.
     * @param {httpCallback} callback - The callback that gets called on response.
     */
    patch(req, callback) {
        return this.request('PATCH', req, callback);
    }

    /**
     * Performs a http 'DELETE' request.
     * @param {httpClientRequest} req - The HTTP request (body) options.
     * @param {httpCallback} callback - The callback that gets called on response.
     */
    delete(req, callback) {
        return this.request('DELETE', req, callback);
    }

    /**
     * Performs a http 'OPTIONS' request.
     * @param {httpClientRequest} req - The HTTP request (body) options.
     * @param {httpCallback} callback - The callback that gets called on response.
     */
    options(req, callback) {
        return this.request('OPTIONS', req, callback);
    }

    /**
     * Performs a http 'TRACE' request.
     * @param {httpClientRequest} req - The HTTP request (body) options.
     * @param {httpCallback} callback - The callback that gets called on response.
     */
    trace(req, callback) {
        return this.request('TRACE', req, callback);
    }

    /**
     * Performs a HTTP request with the specified method.
     * @param {string} method - The HTTP method to perform the request with.
     * @param {httpClientRequest} request - The HTTP request (body) options.
     * @param {httpCallback} callback - The callback that gets called on response.
     * @returns {Promise<Request>}
     */
    request(method, req, callback = () => {}) {
        return singleHttp(
            method, 
            this.baseurl + req.path, 
            req.params, 
            _.defaultsDeep({}, (req.token ? {token: req.token} : {}), this.headers), 
            callback, 
            this.json
        );
    }

}
httpConnector.singleHttp = singleHttp;
module.exports = httpConnector;