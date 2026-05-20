/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

/**
 * Error-handling + echo-loop tests.
 *
 * Two concerns covered here:
 *
 *  1. End-to-end error semantics — a thrown route on the server reaches
 *     the caller as an envelope with `{code, error}` over the right wire
 *     format (text frame for JSON codec, binary frame for msgpack codec).
 *
 *  2. Reflective echo-loop guard — when a server emits an error reply,
 *     the reply itself MUST NOT trigger another error on the peer that
 *     receives it. A path-less / non-proxy envelope arriving on either
 *     codec must be silently absorbed (text path: wsNoPath default NOOP;
 *     binary path: same behavior). Without this, two RestNio peers
 *     connected via a msgpack interconnect bounce error frames at each
 *     other in a tight loop the moment one bad frame hits the wire.
 *
 *  Both concerns apply to direct WS clients AND to proxied requests
 *  through `router.proxy()`.
 */

'use strict';

const should = require('should');
const { spinUp } = require('../helpers/server');
const {
    connect, collect, encodeJson, encodeMsgpack, decodeAny,
    waitFor, wait, msgpackAvailable,
} = require('../helpers/wsClient');

const maybeMsgpack = msgpackAvailable ? describe : describe.skip;

/** Same helper as proxy.js — polls a read fn until pred returns truthy. */
async function until(read, pred, timeoutMs = 1000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const v = read();
        if (pred(v)) return v;
        await new Promise(r => setTimeout(r, 5));
    }
    throw new Error(`until: timeout (last value: ${JSON.stringify(read())})`);
}

describe('Error envelope + echo-loop semantics', function () {

    // -----------------------------------------------------------------
    // Direct WS client (no proxy hop). Confirms the wire shape and that
    // a single bad inbound frame produces at most one error reply.
    // -----------------------------------------------------------------
    describe('direct WS', () => {
        let server;
        afterEach(async () => {
            if (server) await server.close();
            server = null;
        });

        describe('JSON codec', () => {
            it('returns a JSON error envelope when a route throws', async () => {
                server = await spinUp((router) => {
                    router.ws('/boom', () => { throw [418, 'tea time']; });
                });
                const ws = await connect(server.wsUrl);
                const got = collect(ws);
                ws.send(encodeJson({ path: '/boom' }));
                await waitFor(got, 1);
                const reply = decodeAny('json', got[0]);
                reply.should.have.property('code', 418);
                reply.should.have.property('error').which.match(/tea time/);
                ws.close();
            });

            it('emits AT MOST ONE reply for a path-less text envelope (no echo loop)', async () => {
                server = await spinUp(() => { /* no routes */ });
                const ws = await connect(server.wsUrl);
                const got = collect(ws);
                // Path-less + non-error envelope: wsNoPath default is a
                // NOOP, so the server must NOT send any reply back.
                ws.send(encodeJson({ foo: 'bar' }));
                await wait(100);
                got.length.should.equal(0);
                ws.close();
            });

            it('error envelope ({code, error}) fires wsError hook, no reply back', async () => {
                const seen = [];
                server = await spinUp((router) => {
                    router.on('wsError', (params) => seen.push(params));
                });
                const ws = await connect(server.wsUrl);
                const got = collect(ws);
                ws.send(encodeJson({ code: 503, error: 'peer-side fail' }));
                await wait(100);
                got.length.should.equal(0);          // no reply / no echo
                seen.length.should.equal(1);
                seen[0].code.should.equal(503);
                seen[0].error.should.equal('peer-side fail');
                ws.close();
            });

            it('emits AT MOST ONE reply for a stray binary frame on a JSON link', async () => {
                server = await spinUp(() => { /* no routes */ });
                const ws = await connect(server.wsUrl);
                const got = collect(ws);
                // JSON codec's sniff is always false → binary frames go to
                // the default wsBin, which throws 400. The throw produces
                // ONE text-frame error reply (because the link is JSON →
                // err encodes as string → text frame). The reply is text
                // so it can't echo-loop back through the binary path.
                ws.send(Buffer.from([0x81, 0xa1, 0x61, 0x01]));
                await waitFor(got, 1, 500);
                const reply = decodeAny('json', got[0]);
                reply.should.have.property('code', 400);
                // Wait an extra beat — no SECOND reply should arrive.
                await wait(150);
                got.length.should.equal(1);
                ws.close();
            });
        });

        maybeMsgpack('msgpack codec', () => {
            it('returns a msgpack error envelope when a route throws', async () => {
                server = await spinUp((router) => {
                    router.ws('/boom', () => { throw [418, 'tea time']; });
                });
                const ws = await connect(server.wsUrl, 'restnio.msgpack');
                ws.protocol.should.equal('restnio.msgpack');
                const got = collect(ws);
                ws.send(encodeMsgpack({ path: '/boom' }));
                await waitFor(got, 1);
                const reply = decodeAny('msgpack', got[0]);
                reply.should.have.property('code', 418);
                reply.should.have.property('error').which.match(/tea time/);
                ws.close();
            });

            it('error envelope arriving on a binary frame fires wsError + no echo', async () => {
                // Regression test for the reflective-echo bug. On a msgpack
                // link, the server's error reply (`{code, error}`) itself
                // travels as a binary frame, has no path, and is not a
                // proxy frame. Before the fix, the receiver mis-routed
                // path-less binary envelopes to `wsBin`, threw 400, and
                // sent ANOTHER error frame back — two peers bounced 400s
                // forever. After the fix, `wsError` fires and nothing is
                // written back.
                const seen = [];
                server = await spinUp((router) => {
                    router.on('wsError', (params) => seen.push(params));
                });
                const ws = await connect(server.wsUrl, 'restnio.msgpack');
                const got = collect(ws);
                ws.send(encodeMsgpack({ code: 400, error: 'reflected' }));
                await wait(150);
                got.length.should.equal(0);
                seen.length.should.equal(1);
                seen[0].code.should.equal(400);
                seen[0].error.should.equal('reflected');
                ws.close();
            });

            it('a single bad binary frame does not produce a flood of replies', async () => {
                server = await spinUp(() => { /* no routes */ });
                const ws = await connect(server.wsUrl, 'restnio.msgpack');
                const got = collect(ws);
                // Junk that decodes as a non-envelope object: `{x: 1}` →
                // fixmap 0x81, decode succeeds, has neither path nor proxy
                // field. Must not flood reply frames.
                ws.send(encodeMsgpack({ x: 1 }));
                await wait(200);
                got.length.should.be.belowOrEqual(1);
                if (got.length === 1) {
                    const reply = decodeAny('msgpack', got[0]);
                    reply.should.have.property('code');
                }
                ws.close();
            });
        });
    });

    // -----------------------------------------------------------------
    // Proxy hop (api → central → turbine → api). Errors raised on the
    // callee side must surface to the original caller with the right
    // code, AND must not start an echo storm on the peer link.
    // -----------------------------------------------------------------
    describe('proxy', () => {
        let central, turbine, peer;
        afterEach(async () => {
            for (const srv of [central, turbine]) {
                if (!srv) continue;
                for (const p of srv.rnio.inters.values()) {
                    try { p.close(); } catch (_) { /* ignore */ }
                }
            }
            if (central) await central.close();
            if (turbine) await turbine.close();
            central = turbine = peer = null;
        });

        async function buildProxyPair(turbineRoutes, opts = {}) {
            let peerLinkResolve;
            const peerLinked = new Promise(r => { peerLinkResolve = r; });
            turbine = await spinUp((router) => {
                router.on('wsConnect', (_p, client) => {
                    client.linkAsPeer({ shadowOut: ['*'], shadowIn: ['*'] });
                    client.grantPerm('*');
                    peerLinkResolve(client);
                });
                if (turbineRoutes) turbineRoutes(router);
            });
            central = await spinUp((router, rnio) => {
                router.proxy('/turbine/:turbineID', {
                    target: () => rnio.inter('turbine'),
                });
            });
            peer = central.rnio.interconnect('turbine', turbine.wsUrl, {
                permissions: ['*'],
                shadowOut: ['*'], shadowIn: ['*'],
                ...(opts.subprotocol ? { subprotocol: opts.subprotocol } : {}),
            });
            await until(() => peer.isOpen, x => x === true, 1500);
            const turbinePeer = await Promise.race([
                peerLinked,
                new Promise((_, rej) => setTimeout(
                    () => rej(new Error('linkAsPeer timeout')), 1500)),
            ]);
            return turbinePeer;
        }

        /** Counts every wire frame on the peer link, both directions. */
        function wireFrameCounter(turbinePeer) {
            const ctr = { out: 0, in: 0 };
            const origSend = turbinePeer.ws.send.bind(turbinePeer.ws);
            turbinePeer.ws.send = (data, ...rest) => {
                ctr.out++;
                return origSend(data, ...rest);
            };
            // Count inbound frames at the ws event level — fires regardless
            // of whether the frame is text or binary.
            turbinePeer.ws.on('message', () => { ctr.in++; });
            return ctr;
        }

        describe('JSON peer link', () => {
            it('thrown error in callee route surfaces as error to api caller', async () => {
                await buildProxyPair((router) => {
                    router.ws('/pitch/fail', () => { throw [503, 'unit offline']; });
                });
                const ws = await connect(central.wsUrl);
                const got = collect(ws);
                ws.send(encodeJson({ path: '/turbine/WT1/pitch/fail' }));
                await waitFor(got, 1, 2000);
                const reply = decodeAny('json', got[0]);
                reply.should.have.property('code', 503);
                reply.should.have.property('error').which.match(/unit offline/);
                ws.close();
            });

            it('one thrown error does not flood the peer link with reply frames', async () => {
                const turbinePeer = await buildProxyPair((router) => {
                    router.ws('/pitch/fail', () => { throw [400, 'nope']; });
                });
                const ctr = wireFrameCounter(turbinePeer);

                const ws = await connect(central.wsUrl);
                const got = collect(ws);
                ws.send(encodeJson({ path: '/turbine/WT1/pitch/fail' }));
                await waitFor(got, 1, 2000);
                // Wait long enough that an echo loop would have produced
                // hundreds of frames if it were active.
                await wait(300);
                // Sanity: api saw exactly one error.
                got.length.should.equal(1);
                // Peer link saw a bounded number of frames — one request
                // out, one reply back, and at most a couple of housekeeping
                // frames (close, _proxyclose). Anything in the hundreds
                // means a loop is running.
                (ctr.in + ctr.out).should.be.below(20);
                ws.close();
            });
        });

        maybeMsgpack('msgpack peer link', () => {
            it('thrown error in callee route surfaces as error to api caller', async () => {
                const turbinePeer = await buildProxyPair((router) => {
                    router.ws('/pitch/fail', () => { throw [503, 'unit offline']; });
                }, { subprotocol: 'restnio.msgpack' });
                peer.codec.name.should.equal('restnio.msgpack');

                const ws = await connect(central.wsUrl);
                const got = collect(ws);
                ws.send(encodeJson({ path: '/turbine/WT1/pitch/fail' }));
                await waitFor(got, 1, 2000);
                const reply = decodeAny('json', got[0]);
                reply.should.have.property('code', 503);
                reply.should.have.property('error').which.match(/unit offline/);
                ws.close();
                // Silence the still-open peer link via the captured handle.
                turbinePeer.should.be.ok();
            });

            it('one thrown error does not echo-loop the binary peer link', async () => {
                // The actual bug. Pre-fix: when the turbine route throws
                // through a msgpack peer link, the error frame sent back
                // is a path-less binary envelope. Central's handleBinaryFrame
                // would mis-route it to the default wsBin, throw again,
                // send another error frame, and so on — turbine and
                // central bounce 400s indefinitely at ~ms cadence.
                const turbinePeer = await buildProxyPair((router) => {
                    router.ws('/pitch/fail', () => { throw [400, 'nope']; });
                }, { subprotocol: 'restnio.msgpack' });
                peer.codec.name.should.equal('restnio.msgpack');

                const ctr = wireFrameCounter(turbinePeer);

                const ws = await connect(central.wsUrl);
                const got = collect(ws);
                ws.send(encodeJson({ path: '/turbine/WT1/pitch/fail' }));
                await waitFor(got, 1, 2000);
                await wait(400);
                got.length.should.equal(1);
                // <20 frames total on the peer link is generous. A real
                // echo loop generates hundreds within 400ms.
                (ctr.in + ctr.out).should.be.below(20);
                ws.close();
            });

            it('an unsolicited path-less binary frame from one peer does not flood replies', async () => {
                // Inject a path-less envelope DIRECTLY onto the peer link
                // (bypass the normal proxy code) and confirm the receiver
                // doesn't bounce error frames. This is the minimal repro
                // of the production echo storm.
                const turbinePeer = await buildProxyPair((router) => {
                    router.ws('/noop', () => ({ ok: true }));
                }, { subprotocol: 'restnio.msgpack' });
                peer.codec.name.should.equal('restnio.msgpack');

                const ctr = wireFrameCounter(turbinePeer);
                // Send a path-less + non-proxy binary envelope from
                // central onto the peer link. The turbine side must
                // silently absorb it.
                peer.ws.send(encodeMsgpack({ code: 400, error: 'rogue frame' }));
                await wait(400);
                // Generous cap: even a single inbound + single bounce is
                // fine. A loop is hundreds.
                (ctr.in + ctr.out).should.be.below(20);
            });
        });
    });
});
