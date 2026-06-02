/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const _ = require('lodash');

/**
 * @typedef {string | string[] | RegExp | OriginPredicate} OriginConfig
 *
 * What origins are allowed. One of:
 *  - `'*'`         — public API. Any origin reads the response. Disallows
 *                    credentials.
 *  - exact string  — only that origin (case-sensitive). Browser sees that
 *                    exact value echoed back.
 *  - string[]      — allowed if the incoming Origin header is in the set.
 *  - RegExp        — allowed if the incoming Origin header matches.
 *  - function      — `(incoming: string) => boolean`; allowed if it returns
 *                    truthy.
 *
 * Anything other than `'*'` causes the response to echo the incoming Origin
 * (with `Vary: Origin` so caches don't poison) and is the only form
 * compatible with `allowCredentials: true`.
 */

/**
 * @callback OriginPredicate
 * @param {string} incoming - The request's `Origin` header value.
 * @returns {boolean}
 */

/**
 * @typedef CorsOptions
 * @property {OriginConfig} [origin='*'] - What origin to allow. See {@link OriginConfig}.
 * @property {boolean} [allowCredentials=false] - Send `Access-Control-Allow-Credentials: true`.
 *  Cannot be combined with wildcard `origin`, `methods`, or `headers` — the CORS spec
 *  rejects that pairing and the plugin throws at construction time.
 * @property {boolean} [preflight=true] - Register the preflight `OPTIONS` handler.
 * @property {string | string[]} [methods] - Methods to allow on the resource. Defaults to
 *  the common HTTP verbs (`GET, HEAD, POST, PUT, PATCH, DELETE`).
 * @property {string | string[]} [headers='*'] - Request headers to allow. `'*'` reflects
 *  whatever the browser asked for in `Access-Control-Request-Headers` — only legal
 *  when `allowCredentials` is `false`.
 * @property {string[]} [exposeHeaders=[]] - Response headers to expose to JS via
 *  `Access-Control-Expose-Headers` (beyond the seven safelisted ones).
 * @property {number} [maxAge=86400] - Preflight cache lifetime, in seconds. Send `0`
 *  to skip the header.
 */

/**
 * @callback Cors
 * @param {CorsOptions} [options] - CORS options. Defaults are public-safe
 *  (`origin: '*'`, credentials off). Validated on construction.
 * @returns {import("../../routes/Router").RouteBack} The plugin's mountable router back.
 */

// CORS spec language for "common HTTP verbs". OPTIONS is added by the preflight
// handler itself; don't echo it in Access-Control-Allow-Methods unless asked.
const DEFAULT_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'];

const defaults = {
    origin: '*',
    allowCredentials: false,
    preflight: true,
    methods: DEFAULT_METHODS,
    headers: '*',
    exposeHeaders: [],
    maxAge: 86400,
};

/**
 * CORS plugin. Adds `Access-Control-*` response headers and handles preflight
 * `OPTIONS` requests.
 *
 * Mount with a glob so every subpath in the mount context gets covered:
 *
 *     router.use('/**', RestNio.cors());                              // app-wide
 *     router.use('/api**', RestNio.cors({                             // /api/* only
 *         origin: ['https://app.example.com', 'https://staging.example.com'],
 *         allowCredentials: true,
 *         headers: ['content-type', 'authorization'],
 *     }));
 *
 * Mounting without a glob (`router.use(RestNio.cors())` or
 * `router.use('/api', RestNio.cors())`) only attaches CORS to that exact
 * path, NOT to its subpaths — that's a router-prefix semantic, not a plugin
 * bug, but it's a sharp edge in practice.
 *
 * `router.all('/foo', ...)` matches every HTTP verb including `OPTIONS`. If
 * such a route is mounted at a path the cors preflight would otherwise own,
 * the user route wins and the preflight reaches your handler with an empty
 * body. Use specific verbs (`router.post`, `router.get`, …) for any path
 * the browser will preflight.
 *
 * @type {Cors}
 */
module.exports = (options = {}) => {
    const o = _.defaultsDeep({}, options, defaults);

    validateOptions(o);

    const matchOrigin = compileOriginMatcher(o.origin);
    const methodsHeader = Array.isArray(o.methods) ? o.methods.join(', ') : o.methods;
    const exposeHeader = (o.exposeHeaders || []).join(', ');
    const fixedHeadersHeader = headersConfigToHeader(o.headers);

    return (router) => {

        // -- Simple/actual response: passive (isActive: false) handler that
        //    fires alongside any matched active route to attach CORS response
        //    headers. Runs on every verb so credentialed POSTs are covered.
        router.httpAll('', {
            isActive: false,
            func: (_params, client) => {
                const incoming = client.request.headers.origin;
                const allow = matchOrigin(incoming);
                if (allow === null) return;
                client.header('access-control-allow-origin', allow);
                if (allow !== '*') client.header('vary', 'Origin');
                if (o.allowCredentials) client.header('access-control-allow-credentials', 'true');
                if (exposeHeader) client.header('access-control-expose-headers', exposeHeader);
            },
        });

        // -- Preflight: terminating OPTIONS handler.
        if (o.preflight) {
            router.httpOptions('', {
                isActive: true,
                func: (_params, client) => {
                    const incoming = client.request.headers.origin;
                    const allow = matchOrigin(incoming);
                    if (allow === null) {
                        // Origin not in the allow set. Throw an error code the
                        // browser will still interpret as "preflight failed"
                        // (no Access-Control-Allow-Origin), but it's debuggable
                        // from curl/devtools.
                        throw [403, 'origin not allowed'];
                    }
                    client.header('access-control-allow-origin', allow);
                    if (allow !== '*') client.header('vary', 'Origin');
                    if (o.allowCredentials) client.header('access-control-allow-credentials', 'true');
                    client.header('access-control-allow-methods', methodsHeader);

                    let headersHeader = fixedHeadersHeader;
                    if (o.headers === '*' && client.request.headers['access-control-request-headers']) {
                        // Reflect what the browser asked for. The spec only
                        // permits this when credentials are off — already
                        // enforced by validateOptions().
                        headersHeader = client.request.headers['access-control-request-headers'];
                    }
                    if (headersHeader) client.header('access-control-allow-headers', headersHeader);

                    if (o.maxAge > 0) client.header('access-control-max-age', String(o.maxAge));
                    return '';
                },
            });
        }
    };
};

// -- Internals ---------------------------------------------------------------

function validateOptions(o) {
    if (o.allowCredentials) {
        if (o.origin === '*') {
            throw new Error(
                'cors: allowCredentials: true is invalid with origin: "*". ' +
                'Pass an explicit origin (string), array, RegExp, or predicate function.',
            );
        }
        if (o.headers === '*') {
            throw new Error(
                'cors: allowCredentials: true is invalid with headers: "*". ' +
                'List the allowed request headers explicitly (e.g. ["content-type", "authorization"]).',
            );
        }
        if (o.methods === '*' || (Array.isArray(o.methods) && o.methods.includes('*'))) {
            throw new Error(
                'cors: allowCredentials: true is invalid with wildcard methods. ' +
                'Pass an explicit verb list.',
            );
        }
    }
}

function compileOriginMatcher(origin) {
    if (origin === '*') return () => '*';
    if (typeof origin === 'string') {
        return (incoming) => (incoming === origin ? origin : null);
    }
    if (Array.isArray(origin)) {
        const set = new Set(origin);
        return (incoming) => (incoming && set.has(incoming) ? incoming : null);
    }
    if (origin instanceof RegExp) {
        return (incoming) => (incoming && origin.test(incoming) ? incoming : null);
    }
    if (typeof origin === 'function') {
        return (incoming) => (incoming && origin(incoming) ? incoming : null);
    }
    throw new Error(`cors: invalid origin type (${typeof origin}). Expected string, string[], RegExp, or function.`);
}

function headersConfigToHeader(headers) {
    if (headers === '*') return '';     // resolved per-request in the preflight
    if (Array.isArray(headers)) return headers.join(', ');
    return headers || '';
}
