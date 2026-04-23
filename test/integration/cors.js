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

    it('adds access-control-allow-origin on simple requests', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors());
            router.get('/api/thing', () => ({ ok: true }));
        });
        const res = await request('GET', `${server.url}/api/thing`);
        res.status.should.equal(200);
        res.headers['access-control-allow-origin'].should.equal('*');
    });

    it('uses a custom origin when specified', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors({ origin: 'https://example.com' }));
            router.get('/api/thing', () => ({ ok: true }));
        });
        const res = await request('GET', `${server.url}/api/thing`);
        res.headers['access-control-allow-origin'].should.equal('https://example.com');
    });

    it('responds to preflight OPTIONS with the full set of headers', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors({ origin: 'https://example.com' }));
            router.get('/api/thing', () => 'ok');
        });
        const res = await request('OPTIONS', `${server.url}/api/thing`, {
            headers: {
                'origin': 'https://example.com',
                'access-control-request-method': 'GET'
            }
        });
        res.status.should.equal(200);
        res.headers['access-control-allow-origin'].should.equal('https://example.com');
        res.headers['access-control-allow-credentials'].should.equal('true');
        res.headers.should.have.property('access-control-request-method');
        res.headers.should.have.property('access-control-allow-headers');
        res.headers['access-control-max-age'].should.equal('86400');
    });

    it('reflects requested headers when headers="*"', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors());
            router.get('/api/thing', () => 'ok');
        });
        const res = await request('OPTIONS', `${server.url}/api/thing`, {
            headers: { 'access-control-request-headers': 'x-foo, x-bar' }
        });
        res.headers['access-control-allow-headers'].should.equal('x-foo, x-bar');
    });

    it('respects a fixed headers allowlist when not "*"', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors({ headers: 'x-only-this' }));
            router.get('/api/thing', () => 'ok');
        });
        const res = await request('OPTIONS', `${server.url}/api/thing`, {
            headers: { 'access-control-request-headers': 'x-foo, x-bar' }
        });
        res.headers['access-control-allow-headers'].should.equal('x-only-this');
    });

    it('with preflight=false does not register an OPTIONS handler', async () => {
        server = await spinUp((router) => {
            router.use('/api**', RestNio.cors({ preflight: false }));
            router.get('/api/thing', () => 'ok');
        });
        const res = await request('OPTIONS', `${server.url}/api/thing`);
        res.status.should.equal(404);
    });
});
