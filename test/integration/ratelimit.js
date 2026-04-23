const should = require('should');
const RestNio = require('../../');
const { spinUp } = require('../helpers/server');
const { request } = require('../helpers/httpClient');

/**
 * Semantics under test:
 * - The plugin registers its middleware via `router.all('', ...)`, so the
 *   limiter ends up at the sub-router's exact `path`. To cover a group of
 *   routes, mount it at the same path as the route (or use `/api**` to
 *   wildcard both `/api` and everything under it).
 * - Exactly `limit` requests succeed per window; request number `limit + 1`
 *   is rejected (`count >= limit` semantics).
 */
describe('ratelimit plugin (integration)', function() {
    /** @type {import('../helpers/server').SpawnedServer} */
    let server;

    afterEach(async () => {
        if (server) await server.close();
        server = null;
    });

    async function hitN(url, n, opts) {
        const out = [];
        for (let i = 0; i < n; i++) out.push(await request('GET', url, opts));
        return out;
    }

    it('allows exactly `limit` requests, then rejects the next one', async () => {
        server = await spinUp((router) => {
            router.use('/ping', RestNio.ratelimit({ limit: 3, time: '30s' }));
            router.get('/ping', () => 'pong');
        });
        const res = await hitN(`${server.url}/ping`, 4);
        res.slice(0, 3).forEach(r => r.status.should.equal(200));
        res[3].status.should.equal(429);
        res[3].json.should.have.property('error').which.match(/Rate limit/);
    });

    it('sets standard rate-limit headers', async () => {
        server = await spinUp((router) => {
            router.use('/ping', RestNio.ratelimit({ limit: 5, time: '30s' }));
            router.get('/ping', () => 'pong');
        });
        const res = await request('GET', `${server.url}/ping`);
        res.headers.should.have.property('x-ratelimit-limit');
        res.headers.should.have.property('x-ratelimit-remaining');
        res.headers.should.have.property('x-ratelimit-reset');
        Number(res.headers['x-ratelimit-limit']).should.equal(5);
    });

    it('includes retry-after header when the limit is exceeded', async () => {
        server = await spinUp((router) => {
            router.use('/ping', RestNio.ratelimit({ limit: 1, time: '30s' }));
            router.get('/ping', () => 'pong');
        });
        await request('GET', `${server.url}/ping`);          // allowed (1/1)
        const rejected = await request('GET', `${server.url}/ping`); // rejected
        rejected.status.should.equal(429);
        rejected.headers.should.have.property('retry-after');
    });

    it('uses a custom code + message when specified', async () => {
        server = await spinUp((router) => {
            router.use('/ping', RestNio.ratelimit({
                limit: 1, time: '30s',
                code: 418, message: 'please slow down'
            }));
            router.get('/ping', () => 'pong');
        });
        await request('GET', `${server.url}/ping`);
        const rejected = await request('GET', `${server.url}/ping`);
        rejected.status.should.equal(418);
        rejected.json.error.should.match(/please slow down/);
    });

    it('scope=soft tracks each path independently when mounted on a wildcard', async () => {
        // `/api**` matches both `/api` and anything under `/api/`.
        server = await spinUp((router) => {
            router.use('/api**', RestNio.ratelimit({
                limit: 1, time: '30s', scope: 'soft'
            }));
            router.get('/api/a', () => 'A');
            router.get('/api/b', () => 'B');
        });
        // Burn /a's budget (1 allowed, 2nd rejected).
        await request('GET', `${server.url}/api/a`);
        const aRejected = await request('GET', `${server.url}/api/a`);
        aRejected.status.should.equal(429);
        // /b has its own counter under soft scope.
        const bOk = await request('GET', `${server.url}/api/b`);
        bOk.status.should.equal(200);
    });

    it('honors a custom skip function', async () => {
        server = await spinUp((router) => {
            router.use('/ping', RestNio.ratelimit({
                limit: 1, time: '30s',
                skip: (params, client) => client.header('x-skip-me') === 'yes'
            }));
            router.get('/ping', () => 'pong');
        });
        // Three requests that normally would trip the limit, but we skip them.
        const a = await request('GET', `${server.url}/ping`, { headers: { 'x-skip-me': 'yes' } });
        const b = await request('GET', `${server.url}/ping`, { headers: { 'x-skip-me': 'yes' } });
        const c = await request('GET', `${server.url}/ping`, { headers: { 'x-skip-me': 'yes' } });
        a.status.should.equal(200);
        b.status.should.equal(200);
        c.status.should.equal(200);
    });

    it('per=params bucket tracks each param value separately', async () => {
        server = await spinUp((router) => {
            router.use('/who', RestNio.ratelimit({
                limit: 1, time: '30s',
                per: 'params', perParams: ['user']
            }));
            router.get('/who', (params) => `u=${params.user}`);
        });
        // alice burns her allowed hit; 2nd rejected.
        await request('GET', `${server.url}/who?user=alice`);
        const aliceRejected = await request('GET', `${server.url}/who?user=alice`);
        aliceRejected.status.should.equal(429);
        // bob, untouched, still passes.
        const bobOk = await request('GET', `${server.url}/who?user=bob`);
        bobOk.status.should.equal(200);
    });

    it('counter resets after the time window elapses', async () => {
        server = await spinUp((router) => {
            router.use('/ping', RestNio.ratelimit({ limit: 1, time: '150ms' }));
            router.get('/ping', () => 'pong');
        });
        (await request('GET', `${server.url}/ping`)).status.should.equal(200);
        (await request('GET', `${server.url}/ping`)).status.should.equal(429);
        // Wait past the window and try again — fresh budget.
        await new Promise(r => setTimeout(r, 250));
        (await request('GET', `${server.url}/ping`)).status.should.equal(200);
    });
});
