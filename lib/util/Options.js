/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
require('../routes/Route');
const uuid = require('uuid/v4');
/**
 * Typedef imports
 * @typedef {import("../routes/Route").RouteFunc} RouteFunc
 */

/**
 * @typedef Options
 * @property {string} [path=''] - the root path to use.
 * @property {number} [port=7070] - the port to bind the server on.
 * @property {HttpOptions} [options.http] - http settings.
 * @property {WebsocketOptions} [options.websocket] - websocket options.
 * @property {AuthOptions} [options.auth] - auth settings.
 * @property {DefaultOptions} [options.default] - default routes and settings.
 */

 /**
  * @typedef HttpOptions
  * @property {boolean} [enabled=true] - whether the http module should be enabled.
  */

 /**
  * @typedef WebsocketOptions
  * @property {boolean} [enabled=true] - whether the websocket module should be enabled.
  * @property {number} [timeout=30000] - the timeout in ms before unresponsive websocket
  * clients will be kicked from the server.
  * @property {RouteFunc} [motd] - the message of the day, this is a function that gets executed
  * when a websocket client is succesfully connected. Setting to `null` or a noop function
  * will stop the behaviour.
  * @property {boolean} [addUpgradeRoute] - whether or not to add a noop
  * upgrade path specifically for websockets to use the token header seperately.
  */

/**
 * @typedef AuthOptions
 * @property {boolean} [enabled=true] - wether the auth module should be enabled.
 * @property {string} [type='jwt'] - what authentication type to use.
 * (Currently JWT is included and the only supported option)
 * @property {string} [algorithm='HS256'] - the algorithm used to create JWT tokens.
 * @property {string} [secret='random uuid'] - in case tokens are signed with a secret,
 * this is the secret to sign wiht and check against. When using public / private keys this
 * value should be set to `null`.
 * @property {string} [privateKey=null] - the privateKey to encode JWT tokens with.
 * If using an algorithm supporting key pairs, be sure to also set the `auth.secret` option to `null`.
 * @property {string} [publicKey=null] - the publicKey to check JWT tokens with.
 * If using an algorithm supporting key pairs, be sure to also set the `auth.secret` option to `null`.
 * @property {AuthSignOptions} [sign] - sign options used with the JWTs. Dictates thinks like when it expires.
 * @property {AuthVerifyOptions} [verify] - verify options used with the JWTs. Tells what to care about.
 */

/**
 * @typedef AuthSignOptions
 * @property {string} [expiresIn] - how soon the token expires.
 * Expressed in seconds or a string describing a time span zeit/ms. 
 * Eg: 60, "2 days", "10h", "7d". A numeric value is interpreted as a seconds count. 
 * If you use a string be sure you provide the time units (days, hours, etc), 
 * otherwise milliseconds unit is used by default ("120" is equal to "120ms").
 * @property {NumericDate} [exp] - override for how soon the token expires. Given in DatTime.
 * @property {string} [notBefore] - after what time the token starts working.
 * Expressed in seconds or a string describing a time span zeit/ms. 
 * Eg: 60, "2 days", "10h", "7d". A numeric value is interpreted as a seconds count. 
 * If you use a string be sure you provide the time units (days, hours, etc), 
 * otherwise milliseconds unit is used by default ("120" is equal to "120ms").
 * @property {NumericDate} [nbf] - override for how soon the token starts working. Given in DatTime.
 * @property {string} [audience] - what the audience of this token is.
 * @property {string} [issuer] - the issuer of the token. This can be used as extra check
 * and is useful if there are multiple token issuers.
 * @property {string} [jwtid] - optional id.
 * @property {string} [subject] - set subject of token.
 * @property {boolean} [noTimestamp] - stop current timestamp from being automatically
 * filled into the iat claim. Default is false.
 * @property {NumericDate} [iat] - override for the issued at, in case fake/historic tokens are wanted.
 * @property {*} [header] - optional header objects for the signed tokens.
 * @property {*} [keyid] - some id for the token key.
 * @property {boolean} [mutatePayload] - if `true`, the sign function will modify the payload object directly. 
 * This is useful if you need a raw reference to the payload after claims 
 * have been applied to it but before it has been encoded into a token.
 */

 /**
 * @typedef AuthVerifyOptions
 * @property {(string[]|RegExp[])} [audience] - if specified, all audience members that are accaptable.
 * @property {string} [issuer] - if specifed, what the issuer must be.
 * @property {boolean} [ignoreExpiration] - if `true` do not validate the expiration of the token.
 * @property {boolean} [ignoreNotBefore] - if `true` do not validate the starttime of the token.
 * @property {string} [subject] - if specifed, what the subject must be.
 * @property {number} [clockTolerance] - if specified what tolerance to give iat and nbf claims.
 * @property {string} [maxAge] - the maximum allowed age for tokens to still be valid. 
 * Expressed in seconds or a string describing a time span zeit/ms. 
 * Eg: 60, "2 days", "10h", "7d". A numeric value is interpreted as a seconds count. 
 * If you use a string be sure you provide the time units (days, hours, etc), 
 * otherwise milliseconds unit is used by default ("120" is equal to "120ms").
 * @property {number} [clockTimestamp] - the time in seconds that should be used as the current time for all necessary comparisons.
 * Usefull if you want to compare tokens to a certain time.
 * @property {string} [nonce] - if you want to check nonce claim, provide a string value here. It is used on Open ID for the ID Tokens.
 */

 /**
  * @typedef DefaultOptions
  * @property {Object.<string, RouteFunc>} [routes] - default routes to define inside the main
  * router. This is used to define some standard errors and functions that may be overridden if wanted.
  * @property {ClientProperties} [wsProperties] - default websocket-client properties.
  * @property {ClientProperties} [httpProperties] - default http-client properties.
  * @property {ClientProperties} [properties] - default client properties. Applied after default http and ws props.
  * @property {CookieOptions} [cookieOptions] - default cookie options. Applied on top of specific cookie-options.
  */

  /**
   * @typedef ClientProperties
   * @property {boolean} [jsonResponse=false] - whether to prioritise json encoded response
   * over plain strings even if the client is not specifically json.
   * @property {boolean} [jsonError=true] - whether to always send client errors as json
   * regarless of if the request was not json encoded. (such as urlform)
   */

  /**
   * @typedef CookieOptions
   * @property {Date} [expires] - The maximum lifetime of the cookie as an HTTP-date timestamp.
   * If not specified, the cookie will have the lifetime of a session cookie. 
   * A session is finished when the client is shut down meaning that session cookies will get removed at that point. 
   * However, many web browsers have a feature called session restore that will save all your tabs and have them 
   * come back next time you use the browser. Cookies will also be present and it's like you had never actually closed the browser. {MDN}
   * @property {number} [maxAge] - Number of seconds until the cookie expires. 
   * A zero or negative number will expire the cookie immediately.
   * Older browsers (ie6, ie7, and ie8) do not support max-age. For other browsers, 
   * if both (Expires and Max-Age) are set, Max-Age will have precedence. {MDN}
   * @property {string} [domain] - Specifies those hosts to which the cookie will be sent. 
   * If not specified, defaults to the host portion of the current document location (but not including subdomains). 
   * Contrary to earlier specifications, leading dots in domain names are ignored. 
   * If a domain is specified, subdomains are always included. {MDN}
   * @property {string} [path] - Indicates a URL path that must exist in the requested resource before sending the Cookie header. 
   * The %x2F ("/") character is interpreted as a directory separator and sub directories will be matched as well 
   * (e.g. path=/docs, "/docs", "/docs/Web/", or "/docs/Web/HTTP" will all be matched). {MDN}
   * @property {boolean} [secure] - A secure cookie will only be sent to the server when a request is made using SSL and the HTTPS protocol. 
   * However, confidential or sensitive information should never be stored or transmitted in 
   * HTTP Cookies as the entire mechanism is inherently insecure and this doesn't mean that any information is encrypted. {MDN}
   * @property {boolean} [httpOnly] - HTTP-only cookies aren't accessible via JavaScript through the Document.cookie property, 
   * the XMLHttpRequest API, or the Request API to mitigate attacks against cross-site scripting (XSS). {MDN}
   * @property {('Strict'|'Lax')} [sameSite] - Allows servers to assert that a cookie ought not to be sent along with cross-site requests, 
   * which provides some protection against cross-site request forgery attacks (CSRF). {MDN}
   */

/**
 * Contains all default options for RestNio.
 */
module.exports = {
    path: '',
    port: 7070,
    http: {
        enabled: true
    },
    websocket: {
        enabled: true,
        timeout: 30000,
        motd: () => ({message: 'Connected!'}),
        addUpgradeRoute: true
    },
    auth: {
        enabled: true,
        type: 'jwt',
        algorithm: 'HS256',
        secret: uuid(),
        privateKey: null,
        publicKey: null,
        sign: {
            expiresIn: '1h',
            issuer: 'RestNio'
        },
        verify: {
            issuer: ['RestNio']
        }
    },
    default: {
        routes: {
            // Standard errors. These can be overrided to change error messages.
            '404': () => { throw [404, 'page not found']},
            '403': () => { throw [403, 'permission error']},
            '500': () => { throw [500, 'internal server error']}
        },
        wsProperties: {
            jsonResponse: true,
            jsonError: true
        },
        httpProperties: {
            jsonResponse: false,
            jsonError: true
        },
        properties: { },
        cookieOptions: { }
    }
};