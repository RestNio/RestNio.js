const should = require('should');
const RestNio = require('../../');
const { spinUp } = require('../helpers/server');

/**
 * Tests for the client-side ws connector helper (`RestNio.websocket(url, ...)`).
 * Exercises open / message / send-object / close against a real RestNio server.
 */
describe('wsConnector (integration)', function() {
    /** @type {import('../helpers/server').SpawnedServer} */
    let server;

    afterEach(async () => {
        if (server) await server.close();
        server = null;
    });

    /**
     * @param {ReturnType<typeof RestNio.websocket>} client
     * @returns {Promise<void>}
     */
    function waitForClose(client) {
        return new Promise((resolve) => {
            if (client.readyState === client.CLOSED) return resolve();
            client.once('close', () => resolve());
        });
    }

    it('fires onConnect on open and onClose on close', async () => {
        server = await spinUp(() => {});
        let connected = false;
        let closed = false;
        const client = RestNio.websocket(
            server.wsUrl,
            /* onMessage */ () => {},
            /* onConnect */ () => { connected = true; },
            /* onClose */   () => { closed = true; }
        );
        // Wait for open.
        await new Promise(r => client.once('open', r));
        connected.should.be.true();
        client.close();
        await waitForClose(client);
        closed.should.be.true();
    });

    it('delivers incoming JSON envelopes to onMessage (parsed)', async () => {
        server = await spinUp((router) => {
            router.ws('/echo', (params) => ({ echoed: params.msg }));
        });
        const received = [];
        const client = RestNio.websocket(
            server.wsUrl,
            (data) => { received.push(data); },
            () => {
                client.obj({ path: '/echo', params: { msg: 'hi' } });
            }
        );
        // Wait until we get at least one frame back.
        const deadline = Date.now() + 500;
        while (received.length < 1 && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 10));
        }
        client.close();
        await waitForClose(client);
        received.should.have.length(1);
        received[0].should.deepEqual({ echoed: 'hi' });
    });

    it('client.obj() serializes objects as JSON and passes strings / buffers through', async () => {
        const collected = [];
        server = await spinUp((router) => {
            router.ws('/capture', (params) => {
                collected.push(params);
                return { ok: true };
            });
            router.wsBin((params) => {
                collected.push({ raw: params.data.toString() });
                return { ok: true };
            });
        });

        const client = RestNio.websocket(server.wsUrl, () => {});
        await new Promise(r => client.once('open', r));

        client.obj({ path: '/capture', params: { a: 1 } });
        client.obj('{"path":"/capture","params":{"b":2}}'); // plain string passes through
        client.obj(Buffer.from('raw-bytes'));               // buffer → binary frame
        // Give the server time to route all three.
        await new Promise(r => setTimeout(r, 200));
        client.close();
        await waitForClose(client);

        // Order across text vs binary frames isn't deterministic because each
        // frame kicks off an independent async dispatch chain; just assert all
        // three shapes arrived.
        collected.should.have.length(3);
        collected.some(x => x.a === 1).should.be.true();
        collected.some(x => x.b === 2).should.be.true();
        collected.some(x => x.raw === 'raw-bytes').should.be.true();
    });

    it('calls onError when it fails to connect', async () => {
        let errored = false;
        const client = RestNio.websocket(
            'ws://localhost:1/', // nothing listens here
            () => {},
            () => {},
            () => {},
            () => { errored = true; }
        );
        // Wait for error to fire (or timeout).
        const deadline = Date.now() + 500;
        while (!errored && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 10));
        }
        errored.should.be.true();
    });
});
