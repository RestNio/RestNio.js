const should = require('should');
const { spinUp } = require('../helpers/server');
const { connect, collect, encodeJson, decodeAny, waitFor } = require('../helpers/wsClient');

describe('WebSocket routing (integration)', function() {
    /** @type {import('../helpers/server').SpawnedServer} */
    let server;

    afterEach(async () => {
        if (server) await server.close();
        server = null;
    });

    it('routes a JSON envelope and returns a reply', async () => {
        server = await spinUp((router) => {
            router.ws('/hello', (params) => `hi ${params.name}`);
        });
        const ws = await connect(server.wsUrl);
        const got = collect(ws);
        ws.send(encodeJson({ path: '/hello', params: { name: 'esp' } }));
        await waitFor(got, 1);
        ws.close();
        decodeAny('json', got[0]).should.equal('hi esp');
    });

    it('fires wsConnect handlers on connection (single and multiple)', async () => {
        server = await spinUp((router) => {
            router.on('wsConnect', () => ({ motd: 'welcome' }));
            router.on('wsConnect', () => ({ motd: 'second' }));
        });
        const ws = await connect(server.wsUrl);
        const got = collect(ws);
        await waitFor(got, 2);
        ws.close();
        const replies = got.map(e => decodeAny('json', e));
        replies.should.matchEach(r => r.motd !== undefined);
    });

    it('fires wsClose handler when client disconnects', async () => {
        let closeReason = null;
        server = await spinUp((router) => {
            router.on('wsClose', (params) => {
                closeReason = params.reason;
            });
        });
        const ws = await connect(server.wsUrl);
        ws.close(1000, 'bye');
        // Wait until server fires the wsClose handler.
        const deadline = Date.now() + 500;
        while (closeReason === null && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 10));
        }
        should(closeReason).not.be.null();
    });

    it('supports subscriptions and broadcasting via subs()', async () => {
        server = await spinUp((router, rnio) => {
            router.ws('/sub', (params, client) => {
                client.subscribe('room');
                return { ok: true };
            });
            router.ws('/broadcast', () => {
                for (const c of rnio.subs('room')) c.str('ping');
                return { sent: true };
            });
        });
        const a = await connect(server.wsUrl);
        const b = await connect(server.wsUrl);
        const gotA = collect(a);
        const gotB = collect(b);
        a.send(encodeJson({ path: '/sub' }));
        b.send(encodeJson({ path: '/sub' }));
        await waitFor(gotA, 1);
        await waitFor(gotB, 1);
        a.send(encodeJson({ path: '/broadcast' }));
        // Both clients should receive 'ping' + a's broadcast reply
        await waitFor(gotA, 3); // sub-ack, ping, broadcast-ack
        await waitFor(gotB, 2); // sub-ack, ping
        a.close();
        b.close();
        gotB.map(e => decodeAny('json', e)).should.containDeep(['ping']);
    });
});
