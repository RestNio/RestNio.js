const should = require('should');
const { spinUp } = require('../helpers/server');

/**
 * @typedef {import('../helpers/server').SpawnedServer} SpawnedServer
 */

/**
 * Awaits a condition on a polled value with a deadline. Cleaner than ad-hoc
 * `setTimeout` chains and clearer in failure: dumps the value seen on timeout.
 * @template T
 * @param {() => T} read
 * @param {(v: T) => boolean} pred
 * @param {number} [timeoutMs=500]
 * @returns {Promise<T>}
 */
async function until(read, pred, timeoutMs = 500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const v = read();
        if (pred(v)) return v;
        await new Promise(r => setTimeout(r, 5));
    }
    throw new Error(`until: timeout (last value: ${JSON.stringify(read())})`);
}

describe('InterClient (integration)', function() {
    /** @type {SpawnedServer} */ let park;
    /** @type {SpawnedServer} */ let turbine;

    afterEach(async () => {
        // Close interconnect peers FIRST so reconnect timers don't keep node
        // alive after the test ends (which would block process exit and
        // therefore block c8 from emitting its coverage report).
        for (const srv of [turbine, park]) {
            if (!srv) continue;
            for (const peer of srv.rnio.inters.values()) {
                try { peer.close(); } catch (_) { /* ignore */ }
            }
        }
        if (turbine) await turbine.close();
        if (park) await park.close();
        park = turbine = null;
    });

    it('turbine→park: outbound envelope hits a route on the remote', async () => {
        const got = [];
        park = await spinUp((router) => {
            router.ws('/setPower', (params) => { got.push(params); });
        });
        turbine = await spinUp(() => {});

        const peer = turbine.rnio.interconnect('park', park.wsUrl);
        await new Promise(res => { peer.onConnect = res; });
        peer.obj({ path: '/setPower', params: { kw: 1500 } });

        await until(() => got, (g) => g.length === 1, 1000);
        got[0].should.have.property('kw', 1500);
    });

    it('park→turbine: inbound envelope dispatches through registered routes', async () => {
        // Park exposes /register; on register, it pushes a {path:'/cmd', params}
        // envelope back to whoever just registered. The turbine handles /cmd
        // via its peer router (which by default writes into the main rnio.routes).
        park = await spinUp((router) => {
            router.ws('/register', (_params, client) => {
                client.obj({ path: '/cmd', params: { action: 'spin', rpm: 18 } });
            });
        });
        turbine = await spinUp(() => {});

        const cmds = [];
        const peer = turbine.rnio.interconnect('park', park.wsUrl, {
            routes: (r) => {
                r.ws('/cmd', (params) => { cmds.push(params); });
            }
        });
        await new Promise(res => { peer.onConnect = res; });
        peer.obj({ path: '/register' });

        await until(() => cmds, (c) => c.length === 1, 1000);
        cmds[0].should.have.properties({ action: 'spin', rpm: 18 });
    });

    it('isolate: true keeps peer routes invisible to the main rnio.routes table', async () => {
        // Opt-in isolation: /cmd registered via the peer router should NOT be
        // reachable by a normal ws client hitting the turbine's main socket.
        park = await spinUp(() => {});
        const peerHits = [];
        turbine = await spinUp(() => {});
        const peer = turbine.rnio.interconnect('park', park.wsUrl, {
            isolate: true,
            routes: (r) => r.ws('/cmd', () => { peerHits.push(true); })
        });
        await new Promise(res => { peer.onConnect = res; });

        // Hit the turbine's *main* socket from a fresh ws client and try /cmd.
        const { connect, collect, encodeJson, waitFor, decodeAny } = require('../helpers/wsClient');
        const ws = await connect(turbine.wsUrl);
        const got = collect(ws);
        ws.send(encodeJson({ path: '/cmd' }));
        await waitFor(got, 1, 500);
        const reply = decodeAny('json', got[0]);
        peerHits.length.should.equal(0);
        should(reply.code).equal(404);
        ws.close();
    });

    it('buffers frames sent before the socket is open and flushes on connect', async () => {
        const got = [];
        park = await spinUp((router) => {
            router.ws('/early', (params) => { got.push(params); });
        });
        turbine = await spinUp(() => {});

        const peer = turbine.rnio.interconnect('park', park.wsUrl);
        // Fire BEFORE we await onConnect — must end up at the remote anyway.
        peer.obj({ path: '/early', params: { n: 1 } });
        peer.obj({ path: '/early', params: { n: 2 } });

        await until(() => got, (g) => g.length === 2, 1000);
        got.map(g => g.n).should.deepEqual([1, 2]);
    });

    it('reconnects after the remote drops the socket', async () => {
        // Spin up park, connect peer, kill park's socket, spin a *new* park
        // on the same port, expect the peer to land back.
        park = await spinUp((router) => {
            router.ws('/ping', () => {});
        });
        turbine = await spinUp(() => {});

        let connects = 0;
        const peer = turbine.rnio.interconnect('park', park.wsUrl, {
            reconnect: { enabled: true, minDelay: 50, maxDelay: 200, factor: 2, jitter: 0 },
            onConnect: () => { connects++; }
        });
        await until(() => connects, (c) => c >= 1, 1000);

        // Drop park's connection from the server side without closing the
        // listener — peer should retry against the same port.
        for (const c of park.rnio.wsServer.clients) c.terminate();

        await until(() => connects, (c) => c >= 2, 2000);
        connects.should.be.greaterThanOrEqual(2);
    });

    it('close() halts reconnect attempts', async () => {
        park = await spinUp(() => {});
        turbine = await spinUp(() => {});

        let connects = 0;
        let closes = 0;
        const peer = turbine.rnio.interconnect('park', park.wsUrl, {
            reconnect: { enabled: true, minDelay: 50, maxDelay: 200, factor: 2, jitter: 0 },
            onConnect: () => { connects++; },
            onClose: () => { closes++; }
        });
        await until(() => connects, (c) => c === 1, 1000);

        peer.close();
        await until(() => closes, (c) => c >= 1, 500);
        // Wait an extra few cycles — should NOT see another connect.
        await new Promise(r => setTimeout(r, 300));
        connects.should.equal(1);
    });

    it('default (shared) — peer routes ALSO reachable by normal ws clients', async () => {
        // No isolation — peer routes write into rnio.routes, so the same /cmd
        // route fires for both park pushes and local ws clients. The handler
        // intentionally does not RETURN a value: returning a bare string would
        // be sent as a raw text frame on a peer link, the remote would try to
        // JSON.parse it as an envelope, fail, and bounce 500/404 envelopes
        // back forever. For peer-link routes, push replies via client.obj()
        // explicitly when needed.
        park = await spinUp((router) => {
            router.ws('/poke', (_p, client) => {
                client.obj({ path: '/cmd', params: { src: 'park' } });
            });
        });
        const cmds = [];
        turbine = await spinUp(() => {});
        const peer = turbine.rnio.interconnect('park', park.wsUrl, {
            routes: (r) => {
                r.ws('/cmd', (params, client) => {
                    cmds.push(params);
                    // Reply path differs based on the calling client's transport:
                    // local ws client expects an immediate reply; peer link
                    // doesn't (would echo into a 404 loop).
                    if (client.type === 'ws') return { ack: true };
                });
            }
        });
        await new Promise(res => { peer.onConnect = res; });

        // Park push → peer dispatches through main → /cmd fires.
        peer.obj({ path: '/poke' });
        await until(() => cmds, (c) => c.length === 1, 1000);
        cmds[0].should.have.property('src', 'park');

        // Local ws client hitting turbine's main socket — same /cmd should fire.
        const { connect, collect, encodeJson, waitFor, decodeAny } = require('../helpers/wsClient');
        const ws = await connect(turbine.wsUrl);
        const got = collect(ws);
        ws.send(encodeJson({ path: '/cmd', params: { src: 'esp' } }));
        await waitFor(got, 1, 500);
        decodeAny('json', got[0]).should.have.property('ack', true);
        cmds.length.should.equal(2);
        cmds[1].should.have.property('src', 'esp');
        ws.close();
    });

    it('peer.mainRouter lets isolated peers also register on the main table', async () => {
        // Opt-in isolation: /peerOnly stays peer-scoped, /shared lands on main.
        park = await spinUp(() => {});
        const peerHits = [];
        const sharedHits = [];
        turbine = await spinUp(() => {});
        const peer = turbine.rnio.interconnect('park', park.wsUrl, {
            isolate: true,
            routes: (router, p) => {
                router.ws('/peerOnly', () => { peerHits.push(true); });
                p.mainRouter.ws('/shared', () => { sharedHits.push(true); return 'ok'; });
            }
        });
        await new Promise(res => { peer.onConnect = res; });

        // Local ws client can reach /shared but NOT /peerOnly.
        const { connect, collect, encodeJson, waitFor, decodeAny } = require('../helpers/wsClient');
        const ws = await connect(turbine.wsUrl);
        const got = collect(ws);
        ws.send(encodeJson({ path: '/shared' }));
        await waitFor(got, 1, 500);
        decodeAny('json', got[0]).should.equal('ok');
        sharedHits.length.should.equal(1);

        ws.send(encodeJson({ path: '/peerOnly' }));
        await waitFor(got, 2, 500);
        const reply2 = decodeAny('json', got[1]);
        peerHits.length.should.equal(0);
        should(reply2.code).equal(404);
        ws.close();
    });

    it('peer.status reflects connection state through the lifecycle', async () => {
        park = await spinUp(() => {});
        turbine = await spinUp(() => {});

        const peer = turbine.rnio.interconnect('park', park.wsUrl);
        peer.status.should.equal('connecting');
        peer.isOpen.should.equal(false);

        await new Promise(res => { peer.onConnect = res; });
        peer.status.should.equal('open');
        peer.isOpen.should.equal(true);

        peer.close();
        peer.status.should.equal('shut');
        peer.isOpen.should.equal(false);
    });

    it('fires interOpen / interClose route handlers like wsConnect / wsClose', async () => {
        const opens = [];
        const closes = [];
        park = await spinUp(() => {});
        turbine = await spinUp(() => {});

        const peer = turbine.rnio.interconnect('park', park.wsUrl, {
            routes: (router) => {
                router.on('interOpen', (params, p) => { opens.push({ params, name: p.name }); });
                router.on('interClose', (params, p) => { closes.push({ params, name: p.name }); });
            }
        });
        await until(() => opens, (a) => a.length === 1, 1000);
        opens[0].name.should.equal('park');
        opens[0].params.should.have.property('url', park.wsUrl);
        opens[0].params.should.have.property('attempts', 0);

        peer.close();
        await until(() => closes, (c) => c.length === 1, 1000);
        closes[0].name.should.equal('park');
        closes[0].params.should.have.property('reason');
    });

    it('fires interFail after maxAttempts and stops retrying', async () => {
        // Point at a port that nothing is listening on. ws will fail to
        // connect, retries will burn through maxAttempts, and interFail
        // should fire exactly once.
        park = await spinUp(() => {});
        turbine = await spinUp(() => {});
        await park.close(); // Free the port; peer will retry against nothing.
        const fails = [];
        const peer = turbine.rnio.interconnect('park', park.wsUrl, {
            reconnect: { enabled: true, minDelay: 30, maxDelay: 60, factor: 1, jitter: 0, maxAttempts: 3 },
            routes: (router) => {
                router.on('interFail', (params) => { fails.push(params); });
            }
        });
        // Drop default onError logging (it floods the console with ECONNREFUSED).
        peer.onError = () => {};
        await until(() => fails, (f) => f.length === 1, 5000);
        fails[0].should.have.property('attempts');
        fails[0].attempts.should.equal(3);
        fails[0].should.have.property('lastError');
        peer.status.should.equal('failed');

        // Wait an extra tick — should NOT see another fail or further retries.
        const before = fails.length;
        await new Promise(r => setTimeout(r, 200));
        fails.length.should.equal(before);

        // Mark park as null so afterEach doesn't double-close.
        park = null;
    });

    it('peer.reopen() restarts after a failure', async () => {
        // Boot a park, take it down so the peer fails, then bring park back
        // and call reopen() — peer should land back in 'open'.
        park = await spinUp(() => {});
        turbine = await spinUp(() => {});
        const url = park.wsUrl;
        const port = park.port;
        await park.close();
        park = null;

        const fails = [];
        const opens = [];
        const peer = turbine.rnio.interconnect('park', url, {
            reconnect: { enabled: true, minDelay: 30, maxDelay: 60, factor: 1, jitter: 0, maxAttempts: 2 },
            routes: (router) => {
                router.on('interOpen', (params) => { opens.push(params); });
                router.on('interFail', (params) => { fails.push(params); });
            }
        });
        peer.onError = () => {};
        await until(() => fails, (f) => f.length === 1, 5000);
        peer.status.should.equal('failed');

        // Bring park back on the same port and reopen.
        park = await spinUp(() => {}, { port });
        peer.reopen();
        await until(() => opens, (o) => o.length === 1, 2000);
        peer.status.should.equal('open');
        peer.reconnectAttempts.should.equal(0);
    });

    it('rnio.inter(name) returns the registered peer; duplicate names throw', async () => {
        park = await spinUp(() => {});
        turbine = await spinUp(() => {});

        const peer = turbine.rnio.interconnect('park', park.wsUrl);
        turbine.rnio.inter('park').should.equal(peer);
        // Repo throws plain strings, not Error instances — assert via try/catch.
        let dupErr = null;
        try { turbine.rnio.interconnect('park', park.wsUrl); } catch (e) { dupErr = e; }
        String(dupErr).should.match(/already registered/);
        let missErr = null;
        try { turbine.rnio.inter('nope'); } catch (e) { missErr = e; }
        String(missErr).should.match(/No inter/);
    });

});
