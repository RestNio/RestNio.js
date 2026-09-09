/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

/**
 * Unhandled-exception semantics: a route that throws anything other than
 * a `[code, message]` tuple is first offered to the `'500'` observer route.
 *
 *  - Default: no-op observer, the error reaches the client as
 *    `err.toString()` with status 500 (unchanged wire behavior, so apps
 *    can ship their own error classes).
 *  - `router.on('500', fn)` receives `{ error }` + the client and may
 *    replace the reply by throwing a tuple or returning a value.
 *  - A `'500'` handler that itself blows up never recurses or hangs.
 *  - Same contract over WebSocket envelopes.
 */

'use strict';

const should = require('should');
const { spinUp } = require('../helpers/server');
const { request } = require('../helpers/httpClient');
const { connect, collect, encodeJson, decodeAny, waitFor, wait } = require('../helpers/wsClient');

// Silence RestNio's own console.error for expected 500s during these tests.
const quiet = { default: { properties: { logErrors: false } } };

describe('Unhandled exceptions → 500 route', function () {
    /** @type {import('../helpers/server').SpawnedServer} */
    let server;

    afterEach(async () => {
        if (server) await server.close();
        server = null;
    });

    it('by default still sends err.toString() with status 500 (custom error classes keep working)', async () => {
        class NotReady extends Error {
            toString() { return 'NotReady: warming up'; }
        }
        server = await spinUp((router) => {
            router.get('/boom', () => { throw new NotReady('x'); });
        }, quiet);
        const res = await request('GET', `${server.url}/boom`);
        res.status.should.equal(500);
        res.json.should.deepEqual({ code: 500, error: 'NotReady: warming up' });
    });

    it('a no-op observer sees the error and leaves the reply untouched', async () => {
        const seen = [];
        server = await spinUp((router) => {
            router.on('500', (params) => { seen.push(params.error); });
            router.get('/boom', () => { throw new Error('plain'); });
        }, quiet);
        const res = await request('GET', `${server.url}/boom`);
        res.status.should.equal(500);
        res.json.error.should.equal('Error: plain');
        seen.length.should.equal(1);
        seen[0].message.should.equal('plain');
    });

    it('treats a thrown [code, msg] tuple as an intentional client error (unchanged)', async () => {
        const seen = [];
        server = await spinUp((router) => {
            router.on('500', (params) => { seen.push(params); throw [500, 'nope']; });
            router.get('/tea', () => { throw [418, 'tea time']; });
        }, quiet);
        const res = await request('GET', `${server.url}/tea`);
        res.status.should.equal(418);
        res.json.error.should.equal('tea time');
        seen.length.should.equal(0);
    });

    it('router.on(\'500\') receives { error } + client and picks the reply', async () => {
        const seen = [];
        server = await spinUp((router) => {
            router.on('500', (params, client) => {
                seen.push({ error: params.error, route: client.lastroute });
                throw [503, 'custom reply'];
            });
            router.get('/boom', () => { throw new TypeError('kaboom'); });
        }, quiet);
        const res = await request('GET', `${server.url}/boom`);
        res.status.should.equal(503);
        res.json.should.deepEqual({ code: 503, error: 'custom reply' });
        seen.length.should.equal(1);
        seen[0].error.should.be.instanceOf(TypeError);
        seen[0].error.message.should.equal('kaboom');
        seen[0].route.should.match(/\/boom$/);
    });

    it('a 500 handler may return a value to send it instead', async () => {
        server = await spinUp((router) => {
            router.on('500', () => ({ ok: false, reason: 'handled' }));
            router.get('/boom', () => { throw new Error('x'); });
        }, quiet);
        const res = await request('GET', `${server.url}/boom`);
        res.status.should.equal(200);
        res.json.should.deepEqual({ ok: false, reason: 'handled' });
    });

    it('a 500 handler that itself throws a real error does not recurse and still answers 500', async () => {
        let calls = 0;
        server = await spinUp((router) => {
            router.on('500', () => { calls++; throw new Error('handler is broken too'); });
            router.get('/boom', () => { throw new Error('original'); });
        }, quiet);
        const res = await request('GET', `${server.url}/boom`);
        res.status.should.equal(500);
        res.json.code.should.equal(500);
        calls.should.equal(1);
    });

    it('an app-defined 404 answers exactly once, the stacked default stays silent (HTTP + WS)', async () => {
        server = await spinUp((router) => {
            router.on('404', () => { throw [404, 'custom not found']; });
        }, quiet);
        // Both the app handler and the default are registered on '404'.
        server.rnio.routes.get('404').routes.length.should.equal(2);

        const res = await request('GET', `${server.url}/nope`);
        res.status.should.equal(404);
        res.json.should.deepEqual({ code: 404, error: 'custom not found' });

        const ws = await connect(server.wsUrl);
        const got = collect(ws);
        ws.send(encodeJson({ path: '/nope' }));
        await waitFor(got, 1);
        await wait(100);
        got.length.should.equal(1);
        decodeAny('json', got[0]).should.deepEqual({ code: 404, error: 'custom not found' });
        ws.close();
    });

    it('applies the same contract to WebSocket routes', async () => {
        const seen = [];
        server = await spinUp((router) => {
            router.on('500', (params) => { seen.push(params.error); throw [500, 'ws generic']; });
            router.ws('/boom', () => { throw new Error('ws secret detail'); });
        }, quiet);
        const ws = await connect(server.wsUrl);
        const got = collect(ws);
        ws.send(encodeJson({ path: '/boom' }));
        await waitFor(got, 1);
        const reply = decodeAny('json', got[0]);
        reply.should.deepEqual({ code: 500, error: 'ws generic' });
        seen.length.should.equal(1);
        seen[0].message.should.equal('ws secret detail');
        ws.close();
    });
});
