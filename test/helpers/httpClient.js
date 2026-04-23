/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const http = require('http');

/**
 * @typedef HttpResponse
 * @property {number} status - status code.
 * @property {Object<string,string|string[]>} headers - response headers.
 * @property {string} body - response body as UTF-8 string (lossy for binary).
 * @property {Buffer} bodyBuffer - response body as raw bytes.
 * @property {any} [json] - parsed JSON body, if response was valid JSON.
 */

/**
 * Tiny http request helper using node's built-in `http` module. Used by
 * integration tests instead of pulling in a dependency like axios or undici.
 * @param {string} method - HTTP method.
 * @param {string} url - absolute url.
 * @param {object} [options]
 * @param {Object<string,string>} [options.headers]
 * @param {string|Buffer} [options.body]
 * @returns {Promise<HttpResponse>}
 */
function request(method, url, options = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = http.request({
            method,
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            headers: options.headers || {}
        }, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const bodyBuffer = Buffer.concat(chunks);
                const body = bodyBuffer.toString();
                let json;
                try { json = JSON.parse(body); } catch (_) { /* not json */ }
                resolve({ status: res.statusCode, headers: res.headers, body, bodyBuffer, json });
            });
            res.on('error', reject);
        });
        req.on('error', reject);
        if (options.body != null) req.write(options.body);
        req.end();
    });
}

module.exports = { request };
