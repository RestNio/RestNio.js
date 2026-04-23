const should = require('should');
const { spinUp } = require('../helpers/server');
const { request } = require('../helpers/httpClient');
const { connect, collect, encodeJson, decodeAny, waitFor } = require('../helpers/wsClient');

describe('End-to-end scenarios', function() {
    /** @type {import('../helpers/server').SpawnedServer} */
    let server;

    afterEach(async () => {
        if (server) await server.close();
        server = null;
    });

    it('nested routers work with shared prefixes', async () => {
        server = await spinUp((router) => {
            router.get('/', () => 'root');
            router.use('/v1', (sub) => {
                sub.get('/', () => 'v1-root');
                sub.get('/ping', () => 'v1-pong');
                sub.use('/admin', (admin) => {
                    admin.get('/', () => 'admin-root');
                });
            });
        });
        (await request('GET', `${server.url}/`)).body.should.equal('root');
        (await request('GET', `${server.url}/v1/`)).body.should.equal('v1-root');
        (await request('GET', `${server.url}/v1/ping`)).body.should.equal('v1-pong');
        (await request('GET', `${server.url}/v1/admin/`)).body.should.equal('admin-root');
    });

    it('regex-string param formatter rejects out-of-pattern input', async () => {
        const RestNio = require('../../');
        server = await spinUp((router) => {
            router.get('/strtest', {
                params: { str: RestNio.params.regexString('[a-z]*') },
                func: (params) => params
            });
        });
        const ok = await request('GET', `${server.url}/strtest?str=hello`);
        ok.json.should.deepEqual({ str: 'hello' });
        const bad = await request('GET', `${server.url}/strtest?str=BADVAL`);
        bad.status.should.be.within(400, 499);
    });

    it('multi-client subscription + broadcast with close cleanup', async () => {
        server = await spinUp((router, rnio) => {
            router.ws('/join', (params, client) => {
                client.subscribe('chat');
                client.state.name = params.name || 'anon';
                return { joined: true };
            });
            router.ws('/say', (params, client) => {
                const msg = { from: client.state.name, text: params.text };
                for (const c of rnio.subs('chat')) c.obj(msg);
            });
        });

        const a = await connect(server.wsUrl);
        const b = await connect(server.wsUrl);
        const gotA = collect(a);
        const gotB = collect(b);

        a.send(encodeJson({ path: '/join', params: { name: 'alice' } }));
        b.send(encodeJson({ path: '/join', params: { name: 'bob' } }));
        await waitFor(gotA, 1);
        await waitFor(gotB, 1);

        a.send(encodeJson({ path: '/say', params: { text: 'hi' } }));
        // Both should receive a broadcast, plus alice's reply (a sends, a receives too).
        await waitFor(gotA, 2);
        await waitFor(gotB, 2);

        const aReplies = gotA.map(e => decodeAny('json', e));
        const bReplies = gotB.map(e => decodeAny('json', e));
        aReplies.should.matchAny({ from: 'alice', text: 'hi' });
        bReplies.should.matchAny({ from: 'alice', text: 'hi' });

        a.close();
        b.close();
    });

    it('error returned from a route is delivered to the client as structured error', async () => {
        server = await spinUp((router) => {
            router.get('/boom', () => { throw [418, 'teapot time'] });
        });
        const res = await request('GET', `${server.url}/boom`);
        res.status.should.equal(418);
        res.json.should.have.property('error').which.match(/teapot/);
    });

    it('HTTP and WS can share a path via router.all()', async () => {
        server = await spinUp((router) => {
            router.all('/shared', (params, client) => ({ via: client.type }));
        });
        const httpRes = await request('GET', `${server.url}/shared`);
        httpRes.json.should.deepEqual({ via: 'http' });

        const ws = await connect(server.wsUrl);
        const got = collect(ws);
        ws.send(encodeJson({ path: '/shared' }));
        await waitFor(got, 1);
        ws.close();
        decodeAny('json', got[0]).should.deepEqual({ via: 'ws' });
    });
});
