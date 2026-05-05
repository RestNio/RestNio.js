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

    it('isolates a malformed frame to the offending client (no server crash)', async () => {
        // Regression: a single bad frame from one client used to throw
        // synchronously out of the ws Receiver, escape RestNio, and crash the
        // whole process — taking every other connected client down with it.
        // The fix attaches a per-client `'error'` listener so only the
        // offending socket is torn down.
        let closeReason = null;
        server = await spinUp((router) => {
            router.ws('/hello', () => 'hi');
            router.on('wsClose', (params) => { closeReason = params.reason; });
        });
        const a = await connect(server.wsUrl);
        const b = await connect(server.wsUrl);
        const gotB = collect(b);
        // Swallow the client-side error event so mocha doesn't treat the
        // forced disconnect as a test failure.
        a.on('error', () => {});

        // Craft a frame ws will reject in `getInfo()` with
        // WS_ERR_UNEXPECTED_RSV_2_3. Byte 0: FIN(1) RSV1(0) RSV2(1) RSV3(0)
        // opcode(0010 binary) = 0xA2. Byte 1: mask(0) length(0) = 0x00.
        // ws.send() can't be used because it only emits valid frames, so we
        // write directly to the underlying TCP socket.
        a._socket.write(Buffer.from([0xA2, 0x00]));

        // The offending client must close.
        await new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('A did not close')), 500);
            a.once('close', () => { clearTimeout(t); resolve(); });
        });

        // The other client must still be reachable and the server still alive.
        b.send(encodeJson({ path: '/hello' }));
        await waitFor(gotB, 1);
        decodeAny('json', gotB[gotB.length - 1]).should.equal('hi');
        b.close();

        // wsClose route fired with the protocol-error status.
        const deadline = Date.now() + 200;
        while (closeReason === null && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 10));
        }
        should(closeReason).not.be.null();
        closeReason[0].should.equal(1002);
    });

    it('dispatches path-less envelopes to wsNoPath, not WS:/', async () => {
        // Regression: earlier versions defaulted missing-path to '/', which
        // meant a router.get('/') handler also fired on path-less WS frames
        // (because GET regex covers WS:/ too). Path-less frames must now
        // route only to the wsNoPath hook, leaving WS:/ untouched.
        let getHits = 0;
        let noPathHits = 0;
        let noPathFrame = null;
        server = await spinUp((router) => {
            router.get('/', () => { getHits++; return 'home'; });
            router.on('wsNoPath', (params) => {
                noPathHits++;
                noPathFrame = params;
            });
        });
        const ws = await connect(server.wsUrl);
        ws.send(encodeJson({ code: 404, error: 'page not found' }));
        // Give the server a moment to dispatch.
        await new Promise(r => setTimeout(r, 50));
        ws.close();
        getHits.should.equal(0);
        noPathHits.should.equal(1);
        noPathFrame.should.have.properties({ code: 404, error: 'page not found' });
    });

    it('drops path-less envelopes silently when no wsNoPath handler is registered', async () => {
        // No handler registered → frame is silently dropped, no reply sent
        // back. Important for breaking reflective parse-error loops.
        server = await spinUp((router) => {
            router.get('/', () => 'home');
        });
        const ws = await connect(server.wsUrl);
        const got = collect(ws);
        ws.send(encodeJson({ code: 500, error: 'boom' }));
        await new Promise(r => setTimeout(r, 50));
        ws.close();
        got.length.should.equal(0);
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
