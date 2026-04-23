const should = require('should');
const { spinUp } = require('../helpers/server');
const { request } = require('../helpers/httpClient');

/**
 * Covers the HTTP client's cookie read/write helpers and the JWT cookie-token
 * fallback path, which together cover the last uncovered hunk of HttpClient.js.
 */
describe('HTTP cookies (integration)', function() {
    /** @type {import('../helpers/server').SpawnedServer} */
    let server;

    afterEach(async () => {
        if (server) await server.close();
        server = null;
    });

    it('parses Cookie header into client.cookies', async () => {
        server = await spinUp((router) => {
            router.get('/read', (params, client) => ({
                session: client.cookie('session'),
                flavor: client.cookie('flavor')
            }));
        });
        const res = await request('GET', `${server.url}/read`, {
            headers: { cookie: 'session=abc123; flavor=chocolate' }
        });
        res.json.should.deepEqual({ session: 'abc123', flavor: 'chocolate' });
    });

    it('sets a cookie with all options serialised into Set-Cookie', async () => {
        server = await spinUp((router) => {
            router.get('/set', (params, client) => {
                client.cookie('session', 'deadbeef', {
                    maxAge: 3600,
                    domain: 'example.com',
                    path: '/',
                    secure: true,
                    httpOnly: true,
                    sameSite: 'Strict'
                });
                return { set: true };
            });
        });
        const res = await request('GET', `${server.url}/set`);
        const sc = res.headers['set-cookie'];
        should(sc).not.be.undefined();
        const joined = Array.isArray(sc) ? sc.join(' ') : sc;
        joined.should.match(/session=deadbeef/);
        joined.should.match(/Max-Age=3600/);
        joined.should.match(/Domain=example\.com/);
        joined.should.match(/Path=\//);
        joined.should.match(/Secure/);
        joined.should.match(/HttpOnly/);
        joined.should.match(/SameSite=Strict/);
    });

    it('accepts a maxAge given as an ms string like "1h"', async () => {
        server = await spinUp((router) => {
            router.get('/set', (params, client) => {
                client.cookie('session', 'x', { maxAge: '1h' });
                return { set: true };
            });
        });
        const res = await request('GET', `${server.url}/set`);
        const sc = res.headers['set-cookie'];
        const joined = Array.isArray(sc) ? sc.join(' ') : sc;
        joined.should.match(/Max-Age=3600000/); // 1h in ms
    });

    it('accepts an absolute Expires date', async () => {
        const when = new Date(Date.UTC(2030, 0, 1));
        server = await spinUp((router) => {
            router.get('/set', (params, client) => {
                client.cookie('session', 'x', { expires: when });
                return { set: true };
            });
        });
        const res = await request('GET', `${server.url}/set`);
        const sc = res.headers['set-cookie'];
        const joined = Array.isArray(sc) ? sc.join(' ') : sc;
        joined.should.match(/Expires=/);
        joined.should.match(/2030/);
    });

    it('clearCookie expires the cookie immediately', async () => {
        server = await spinUp((router) => {
            router.get('/clear', (params, client) => {
                client.clearCookie('session');
                return { cleared: true };
            });
        });
        const res = await request('GET', `${server.url}/clear`);
        const sc = res.headers['set-cookie'];
        should(sc).not.be.undefined();
        const joined = Array.isArray(sc) ? sc.join(' ') : sc;
        joined.should.match(/session=/);
        joined.should.match(/Expires=/);
    });

    it('silently drops a malformed cookie-token and clears the cookie', async () => {
        // cookietoken path: when no `token` header is present but the cookie
        // jar has a `token` cookie, the client tries to verify it. On failure
        // it clears the cookie instead of erroring out.
        server = await spinUp((router) => {
            router.get('/ping', () => ({ ok: true }));
        }, {
            auth: {
                enabled: true, type: 'jwt', algorithm: 'HS256',
                secret: 'test', sign: { issuer: 'RestNio' },
                verify: { issuer: ['RestNio'] },
                cookietoken: true
            }
        });
        const res = await request('GET', `${server.url}/ping`, {
            headers: { cookie: 'token=not-a-real-jwt' }
        });
        res.status.should.equal(200);
        res.json.should.deepEqual({ ok: true });
        // The clearCookie should have written a Set-Cookie header that expires `token`.
        const sc = res.headers['set-cookie'];
        should(sc).not.be.undefined();
        const joined = Array.isArray(sc) ? sc.join(' ') : sc;
        joined.should.match(/token=/);
    });
});
