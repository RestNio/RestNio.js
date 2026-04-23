const should = require('should');
const { spinUp } = require('../helpers/server');
const {
    connect, collect, encodeJson, encodeMsgpack, decodeAny, waitFor, msgpackAvailable
} = require('../helpers/wsClient');

const maybeMsgpack = msgpackAvailable ? describe : describe.skip;

describe('Binary routing + codec negotiation (integration)', function() {
    /** @type {import('../helpers/server').SpawnedServer} */
    let server;

    function buildUploadServer() {
        return spinUp((router) => {
            router.ws('/upload-start', (params, client) => {
                client.state.file = Buffer.alloc(0);
                client.state.expectedSize = params.size || 0;
                client.setBinRoute('file');
                return { ok: true, acceptingBinary: true };
            });
            router.wsBin('file', (params, client) => {
                client.state.file = Buffer.concat([client.state.file, params.data]);
                if (client.state.expectedSize && client.state.file.length >= client.state.expectedSize) {
                    client.clearBinRoute();
                    const received = client.state.file;
                    client.state.file = null;
                    return { ok: true, uploaded: received.length };
                }
            });
            router.wsBin((params) => ({ stray: true, size: params.size }));
            router.ws('/hello', (params) => `hi ${params.name || 'there'}`);
        });
    }

    afterEach(async () => {
        if (server) await server.close();
        server = null;
    });

    describe('JSON codec', () => {
        it('dispatches text envelopes over a text frame', async () => {
            server = await buildUploadServer();
            const ws = await connect(server.wsUrl);
            const got = collect(ws);
            ws.send(encodeJson({ path: '/hello', params: { name: 'world' } }));
            await waitFor(got, 1);
            ws.close();
            decodeAny('json', got[0]).should.equal('hi world');
        });

        it('routes stray binary to default wsBin when no binRoute set', async () => {
            server = await buildUploadServer();
            const ws = await connect(server.wsUrl);
            const got = collect(ws);
            ws.send(Buffer.from([1, 2, 3, 4, 5]));
            await waitFor(got, 1);
            ws.close();
            decodeAny('json', got[0]).should.deepEqual({ stray: true, size: 5 });
        });

        it('routes chunked upload to wsBin-file when binRoute is set', async () => {
            server = await buildUploadServer();
            const ws = await connect(server.wsUrl);
            const got = collect(ws);
            ws.send(encodeJson({ path: '/upload-start', params: { size: 16 } }));
            await waitFor(got, 1);
            ws.send(Buffer.from([0xde, 0xad, 0xbe, 0xef, 0, 1, 2, 3]));
            ws.send(Buffer.from([4, 5, 6, 7, 8, 9, 10, 11]));
            await waitFor(got, 2);
            ws.close();
            const replies = got.map(e => decodeAny('json', e));
            replies[0].should.have.property('acceptingBinary').which.equals(true);
            replies[1].should.have.property('uploaded').which.equals(16);
        });
    });

    maybeMsgpack('MessagePack codec', () => {
        it('negotiates restnio.msgpack via subprotocol header', async () => {
            server = await buildUploadServer();
            const ws = await connect(server.wsUrl, 'restnio.msgpack');
            ws.protocol.should.equal('restnio.msgpack');
            ws.close();
        });

        it('dispatches msgpack envelopes sniffed on a binary frame', async () => {
            server = await buildUploadServer();
            const ws = await connect(server.wsUrl, 'restnio.msgpack');
            const got = collect(ws);
            ws.send(encodeMsgpack({ path: '/hello', params: { name: 'esp' } }));
            await waitFor(got, 1);
            ws.close();
            decodeAny('msgpack', got[0]).should.equal('hi esp');
        });

        it('setBinRoute beats envelope sniff (raw bytes that LOOK like a fixmap)', async () => {
            server = await buildUploadServer();
            const ws = await connect(server.wsUrl, 'restnio.msgpack');
            const got = collect(ws);
            ws.send(encodeMsgpack({ path: '/upload-start', params: { size: 4 } }));
            await waitFor(got, 1);
            // These bytes sniff as a fixmap but binRoute=file is active, so the
            // frame MUST be treated as raw binary and land in wsBin-file.
            ws.send(Buffer.from([0x81, 0xa1, 0x61, 0x01]));
            await waitFor(got, 2);
            ws.close();
            const replies = got.map(e => decodeAny('msgpack', e));
            replies[0].acceptingBinary.should.be.true();
            replies[1].uploaded.should.equal(4);
        });
    });

    describe('default wsBin', () => {
        it('returns 400 when unhandled binary arrives and no user default is registered', async () => {
            server = await spinUp((router) => {
                router.ws('/noop', () => ({})); // no wsBin registered at all
            });
            const ws = await connect(server.wsUrl);
            const got = collect(ws);
            ws.send(Buffer.from([1, 2, 3]));
            await waitFor(got, 1);
            ws.close();
            const reply = decodeAny('json', got[0]);
            reply.should.have.property('code').which.equals(400);
        });
    });
});
