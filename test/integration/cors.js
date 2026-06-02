const should = require('should');
const RestNio = require('../../');
const { spinUp } = require('../helpers/server');
const { request } = require('../helpers/httpClient');

describe('cors plugin (integration)', function() {
    /** @type {import('../helpers/server').SpawnedServer} */
    let server;

    afterEach(async () => {
        if (server) await server.close();
        server = null;
    });

    // --------------------------------------------------------------------
    // Defaults
    // --------------------------------------------------------------------

    it('adds access-control-allow-origin: * on simple requests by default', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors());
            router.get('/api/thing', () => ({ ok: true }));
        });
        const res = await request('GET', `${server.url}/api/thing`);
        res.status.should.equal(200);
        res.headers['access-control-allow-origin'].should.equal('*');
        // Credentials default is OFF — header MUST NOT appear.
        should(res.headers['access-control-allow-credentials']).be.undefined();
    });

    it('does not emit Vary: Origin when origin is wildcard', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors());
            router.get('/api/thing', () => ({ ok: true }));
        });
        const res = await request('GET', `${server.url}/api/thing`);
        should(res.headers['vary']).be.undefined();
    });

    // --------------------------------------------------------------------
    // Origin: string
    // --------------------------------------------------------------------

    it('echoes a configured string origin only when the request matches', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors({ origin: 'https://example.com' }));
            router.get('/api/thing', () => 'ok');
        });

        const ok = await request('GET', `${server.url}/api/thing`, {
            headers: { origin: 'https://example.com' },
        });
        ok.headers['access-control-allow-origin'].should.equal('https://example.com');
        ok.headers['vary'].should.equal('Origin');

        const bad = await request('GET', `${server.url}/api/thing`, {
            headers: { origin: 'https://evil.example' },
        });
        should(bad.headers['access-control-allow-origin']).be.undefined();
    });

    // --------------------------------------------------------------------
    // Origin: array, regex, function
    // --------------------------------------------------------------------

    it('accepts an array of origins', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors({
                origin: ['https://a.example.com', 'https://b.example.com'],
            }));
            router.get('/api/thing', () => 'ok');
        });
        const a = await request('GET', `${server.url}/api/thing`, {
            headers: { origin: 'https://b.example.com' },
        });
        a.headers['access-control-allow-origin'].should.equal('https://b.example.com');
        const x = await request('GET', `${server.url}/api/thing`, {
            headers: { origin: 'https://c.example.com' },
        });
        should(x.headers['access-control-allow-origin']).be.undefined();
    });

    it('accepts a RegExp origin', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors({ origin: /^https:\/\/.*\.example\.com$/ }));
            router.get('/api/thing', () => 'ok');
        });
        const ok = await request('GET', `${server.url}/api/thing`, {
            headers: { origin: 'https://staging.example.com' },
        });
        ok.headers['access-control-allow-origin'].should.equal('https://staging.example.com');
        const no = await request('GET', `${server.url}/api/thing`, {
            headers: { origin: 'https://example.org' },
        });
        should(no.headers['access-control-allow-origin']).be.undefined();
    });

    it('accepts a predicate function as origin', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors({
                origin: (incoming) => incoming.endsWith('.trusted.test'),
            }));
            router.get('/api/thing', () => 'ok');
        });
        const ok = await request('GET', `${server.url}/api/thing`, {
            headers: { origin: 'https://app.trusted.test' },
        });
        ok.headers['access-control-allow-origin'].should.equal('https://app.trusted.test');
        const no = await request('GET', `${server.url}/api/thing`, {
            headers: { origin: 'https://app.untrusted.test' },
        });
        should(no.headers['access-control-allow-origin']).be.undefined();
    });

    // --------------------------------------------------------------------
    // Preflight
    // --------------------------------------------------------------------

    it('responds to preflight OPTIONS with the full set of headers', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors({
                origin: 'https://example.com',
                allowCredentials: true,
                headers: ['content-type', 'authorization'],
            }));
            router.get('/api/thing', () => 'ok');
        });
        const res = await request('OPTIONS', `${server.url}/api/thing`, {
            headers: {
                origin: 'https://example.com',
                'access-control-request-method': 'GET',
            },
        });
        res.status.should.equal(200);
        res.headers['access-control-allow-origin'].should.equal('https://example.com');
        res.headers['access-control-allow-credentials'].should.equal('true');
        res.headers['vary'].should.equal('Origin');
        res.headers['access-control-allow-methods'].should.containEql('GET');
        res.headers['access-control-allow-headers'].should.equal('content-type, authorization');
        res.headers['access-control-max-age'].should.equal('86400');
    });

    it('reflects requested headers when headers="*" (the default)', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors());
            router.get('/api/thing', () => 'ok');
        });
        const res = await request('OPTIONS', `${server.url}/api/thing`, {
            headers: { 'access-control-request-headers': 'x-foo, x-bar' },
        });
        res.headers['access-control-allow-headers'].should.equal('x-foo, x-bar');
    });

    it('respects a fixed headers allowlist when not "*"', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors({ headers: 'x-only-this' }));
            router.get('/api/thing', () => 'ok');
        });
        const res = await request('OPTIONS', `${server.url}/api/thing`, {
            headers: { 'access-control-request-headers': 'x-foo, x-bar' },
        });
        res.headers['access-control-allow-headers'].should.equal('x-only-this');
    });

    it('preflight: rejects an unallowed origin with 403', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors({ origin: 'https://example.com' }));
            router.get('/api/thing', () => 'ok');
        });
        const res = await request('OPTIONS', `${server.url}/api/thing`, {
            headers: { origin: 'https://evil.example' },
        });
        // 403 is enough — browsers fail any non-2xx preflight, regardless of
        // headers. (The framework's global `corsErrorOrigin: '*'` default
        // still attaches an allow-origin header on errors so they're visible
        // to fetch error handlers — that's a separate, intentional behavior.)
        res.status.should.equal(403);
    });

    it('with preflight=false does not register an OPTIONS handler', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors({ preflight: false }));
            router.get('/api/thing', () => 'ok');
        });
        const res = await request('OPTIONS', `${server.url}/api/thing`);
        res.status.should.equal(404);
    });

    // --------------------------------------------------------------------
    // Expose-Headers
    // --------------------------------------------------------------------

    it('emits Access-Control-Expose-Headers when configured', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors({ exposeHeaders: ['x-total-count', 'x-page'] }));
            router.get('/api/thing', () => 'ok');
        });
        const res = await request('GET', `${server.url}/api/thing`);
        res.headers['access-control-expose-headers'].should.equal('x-total-count, x-page');
    });

    // --------------------------------------------------------------------
    // Construction-time validation
    // --------------------------------------------------------------------

    it('throws when allowCredentials: true is paired with origin: "*"', () => {
        (() => RestNio.cors({ allowCredentials: true })).should.throw(/allowCredentials/);
    });

    it('throws when allowCredentials: true is paired with headers: "*"', () => {
        (() =>
            RestNio.cors({
                origin: 'https://example.com',
                allowCredentials: true,
                headers: '*',
            })
        ).should.throw(/allowCredentials/);
    });

    it('throws on an invalid origin type', () => {
        (() => RestNio.cors({ origin: 42 })).should.throw(/invalid origin/);
    });
});
