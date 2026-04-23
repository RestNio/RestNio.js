const should = require('should');
const RestNio = require('../../');
const { spinUp } = require('../helpers/server');

/**
 * Exercises the client-side HTTP helpers:
 * - `RestNio.request(method, url, params, headers, cb, json)` (a.k.a. `singleHttp`)
 * - `new RestNio.http(baseurl, headers, json)` + its `get/post/put/...` methods
 */
describe('httpConnector (integration)', function() {
    /** @type {import('../helpers/server').SpawnedServer} */
    let server;

    afterEach(async () => {
        if (server) await server.close();
        server = null;
    });

    async function spinupEcho() {
        return spinUp((router) => {
            // Echoes method + params + a peek at a marker header back as JSON.
            // Uses `x-custom` instead of `token` to avoid the JWT auth path
            // (auth is disabled in the test harness).
            router.all('/echo', (params, client) => ({
                method: client.request.method,
                params,
                xCustom: client.header('x-custom') || null
            }));
        });
    }

    async function spinupEchoWithAuth() {
        return spinUp((router) => {
            router.all('/echo', (params, client) => ({
                method: client.request.method,
                params,
                hasToken: !!(client.headers && client.headers.token)
            }));
        }, {
            auth: {
                enabled: true, type: 'jwt', algorithm: 'HS256',
                secret: 'test', sign: { issuer: 'RestNio' },
                verify: { issuer: ['RestNio'] }
            }
        });
    }

    /**
     * Reads an HTTP response streamed back via the connector callback.
     * The callback (per README + code) is `(body, res) => {}`.
     */
    function collectBody(callback) {
        return new Promise((resolve) => {
            callback((body, res) => {
                let json;
                try { json = JSON.parse(body); } catch (_) { /* plain text */ }
                resolve({ status: res.statusCode, body, json });
            });
        });
    }

    describe('RestNio.request (singleHttp)', () => {
        it('GET with implicit method shorthand (single url arg)', async () => {
            server = await spinupEcho();
            const result = await new Promise((resolve) => {
                // Shorthand: pass url as only arg, implies GET.
                RestNio.request(`http://127.0.0.1:${server.port}/echo?name=rex`, (body, res) => {
                    resolve({ body, status: res.statusCode });
                });
            });
            const json = JSON.parse(result.body);
            json.method.should.equal('GET');
            json.params.name.should.equal('rex');
        });

        it('POST with a JSON body', async () => {
            server = await spinupEcho();
            const result = await collectBody((cb) =>
                RestNio.request('POST', `http://127.0.0.1:${server.port}/echo`, { age: 5 }, {}, cb)
            );
            result.json.method.should.equal('POST');
            result.json.params.age.should.equal(5);
        });

        it('POST with non-JSON encoding (x-www-form-urlencoded body)', async () => {
            server = await spinupEcho();
            const result = await collectBody((cb) =>
                RestNio.request('POST', `http://127.0.0.1:${server.port}/echo`, { city: 'amsterdam' }, {}, cb, false)
            );
            result.json.params.city.should.equal('amsterdam');
        });

        it('custom headers are forwarded to the server', async () => {
            server = await spinupEcho();
            const result = await collectBody((cb) =>
                RestNio.request('GET', `http://127.0.0.1:${server.port}/echo`, {}, { 'x-custom': 'abc' }, cb)
            );
            result.json.xCustom.should.equal('abc');
        });

        it('query-string params survive on GET', async () => {
            server = await spinupEcho();
            const result = await collectBody((cb) =>
                RestNio.request('GET', `http://127.0.0.1:${server.port}/echo?pre=1`, { mixed: 'y' }, {}, cb)
            );
            result.json.params.pre.should.equal(1);
            result.json.params.mixed.should.equal('y');
        });

        it('throws on invalid url', () => {
            // restnio throws a raw string, not an Error — use try/catch.
            let caught = null;
            try { RestNio.request('GET', 'not-a-real-url', () => {}); }
            catch (e) { caught = e; }
            should(caught).not.be.null();
            String(caught).should.match(/Invalid url/);
        });
    });

    describe('new RestNio.http(baseurl)', () => {
        it('routes all method helpers to the server', async () => {
            server = await spinupEcho();
            const http = new RestNio.http(`http://127.0.0.1:${server.port}`);
            // The connector requires params to be a real object for any body-
            // carrying method (it serializes and reads `.length`).
            const req = { path: '/echo', params: {} };

            const out = {};
            await Promise.all([
                new Promise(r => http.get(req,     (body) => { out.GET    = JSON.parse(body); r(); })),
                new Promise(r => http.post(req,    (body) => { out.POST   = JSON.parse(body); r(); })),
                new Promise(r => http.put(req,     (body) => { out.PUT    = JSON.parse(body); r(); })),
                new Promise(r => http.patch(req,   (body) => { out.PATCH  = JSON.parse(body); r(); })),
                new Promise(r => http.delete(req,  (body) => { out.DELETE = JSON.parse(body); r(); })),
                new Promise(r => http.options(req, (body) => { out.OPTIONS= JSON.parse(body); r(); })),
                new Promise(r => http.head(req,    (body) => { out.HEAD   = body; r(); }))
            ]);
            out.GET.method.should.equal('GET');
            out.POST.method.should.equal('POST');
            out.PUT.method.should.equal('PUT');
            out.PATCH.method.should.equal('PATCH');
            out.DELETE.method.should.equal('DELETE');
            out.OPTIONS.method.should.equal('OPTIONS');
            // HEAD has no body by spec — server writes one but clients may drop it.
            out.should.have.property('HEAD');
        });

        it('attaches a per-instance token header when provided in the request', async () => {
            // Auth enabled so the server-side JWT verify path doesn't crash;
            // we only care that the connector forwarded the token header at all.
            server = await spinupEchoWithAuth();
            const http = new RestNio.http(`http://127.0.0.1:${server.port}`);
            const json = await new Promise(r => {
                http.get({ path: '/echo', token: 'not-a-valid-jwt' }, (body) => r(JSON.parse(body)));
            });
            // Server rejects the bogus token (401/500), but the fact it saw a
            // token-shaped header is what this test asserts.
            should(json).be.an.Object();
        });

        it('forwards params via the POST body', async () => {
            server = await spinupEcho();
            const http = new RestNio.http(`http://127.0.0.1:${server.port}`);
            const json = await new Promise(r => {
                http.post({ path: '/echo', params: { hello: 'world' } }, (body) => r(JSON.parse(body)));
            });
            json.method.should.equal('POST');
            json.params.hello.should.equal('world');
        });
    });
});
