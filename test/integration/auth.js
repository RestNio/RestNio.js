const should = require('should');
const { spinUp } = require('../helpers/server');
const { request } = require('../helpers/httpClient');

describe('JWT auth (integration)', function() {
    /** @type {import('../helpers/server').SpawnedServer} */
    let server;

    afterEach(async () => {
        if (server) await server.close();
        server = null;
    });

    async function buildServer() {
        return spinUp((router, rnio) => {
            router.get('/token', () => rnio.token.grant(['dog.feed']));
            router.get('/feed', {
                permissions: ['dog.feed'],
                func: () => ({ fed: true })
            });
            router.get('/admin', {
                permissions: ['admin'],
                func: () => ({ ok: true })
            });
        }, {
            auth: {
                enabled: true,
                type: 'jwt',
                algorithm: 'HS256',
                secret: 'test-secret',
                sign: { expiresIn: '1h', issuer: 'RestNio' },
                verify: { issuer: ['RestNio'] }
            }
        });
    }

    it('grants a JWT on /token', async () => {
        server = await buildServer();
        const res = await request('GET', `${server.url}/token`);
        res.status.should.equal(200);
        res.body.should.be.a.String();
        res.body.length.should.be.greaterThan(20);
    });

    it('allows access with a valid token', async () => {
        server = await buildServer();
        const tokenRes = await request('GET', `${server.url}/token`);
        const token = tokenRes.body;
        const feedRes = await request('GET', `${server.url}/feed`, {
            headers: { token }
        });
        feedRes.status.should.equal(200);
        feedRes.json.should.deepEqual({ fed: true });
    });

    it('denies access when required permission is missing', async () => {
        server = await buildServer();
        const tokenRes = await request('GET', `${server.url}/token`);
        const token = tokenRes.body;
        const adminRes = await request('GET', `${server.url}/admin`, {
            headers: { token }
        });
        adminRes.status.should.be.within(400, 499);
    });

    it('denies access with no token when permission is required', async () => {
        server = await buildServer();
        const res = await request('GET', `${server.url}/feed`);
        res.status.should.be.within(400, 499);
    });
});
