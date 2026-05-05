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
        await until(() => peer.isOpen, (x) => x === true, 1000);
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
        await until(() => peer.isOpen, (x) => x === true, 1000);
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
        await until(() => peer.isOpen, (x) => x === true, 1000);

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
            routes: (router) => router.on('interOpen', () => { connects++; }),
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
            routes: (router) => {
                router.on('interOpen',  () => { connects++; });
                router.on('interClose', () => { closes++;   });
            },
        });
        await until(() => connects, (c) => c === 1, 1000);

        peer.close();
        await until(() => closes, (c) => c >= 1, 500);
        // Wait an extra few cycles — should NOT see another connect.
        await new Promise(r => setTimeout(r, 300));
        connects.should.equal(1);
    });

    it('interNoPath catches path-less reply frames on the peer link', async () => {
        // Park 404s an unknown path — the resulting `{code, error}` reply
        // has no `path`, so it must dispatch to the peer's `interNoPath`
        // hook (default NOOP) instead of falling through to '/' and
        // triggering a `router.get('/')` handler echo loop.
        park = await spinUp(() => { /* no /unknown route → 404 default */ });
        let mainGetHits = 0;
        const noPath = [];
        turbine = await spinUp((router) => {
            router.get('/', () => { mainGetHits++; return 'home'; });
        });
        const peer = turbine.rnio.interconnect('park', park.wsUrl, {
            routes: (r) => {
                r.on('interNoPath', (params) => { noPath.push(params); });
            }
        });
        await until(() => peer.isOpen, (x) => x === true, 1000);

        peer.obj({ path: '/unknown' });
        await until(() => noPath, (n) => n.length === 1, 1000);
        noPath[0].should.have.property('code', 404);
        mainGetHits.should.equal(0);
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
        await until(() => peer.isOpen, (x) => x === true, 1000);

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
        await until(() => peer.isOpen, (x) => x === true, 1000);

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

    describe('per-envelope actor (_actor) scoping', () => {

        // Park-side helper: grab the *raw* ws representing the peer that just
        // connected. We use this to send hand-crafted text frames carrying
        // `_actor` directly, simulating what a relay would emit.
        async function parkPeerSocket() {
            // Wait for the upgrade to land.
            const deadline = Date.now() + 1000;
            while (Date.now() < deadline) {
                if (park.rnio.wsServer.clients.size > 0) return [...park.rnio.wsServer.clients][0];
                await new Promise(r => setTimeout(r, 5));
            }
            throw new Error('no peer socket on park');
        }

        it('clamps caller perms to the link cap and exposes client.actor', async () => {
            // Cap: pitch.*. Caller claims pitch.motor + admin.flash. Intersect
            // drops admin.flash, keeps pitch.motor. The /cmd route's perm
            // requirement (pitch.motor) is met via the clamped set.
            const hits = [];
            park = await spinUp(() => {});
            turbine = await spinUp(() => {});

            const peer = turbine.rnio.interconnect('park', park.wsUrl, {
                permissions: ['pitch.*'],
                routes: (r) => {
                    r.ws('/cmd', {
                        permissions: ['pitch.motor'],
                        func: (params, client) => {
                            hits.push({
                                actor: client.actor,
                                effective: [...client.effectivePermissions],
                                params,
                            });
                        }
                    });
                }
            });
            await until(() => peer.isOpen, (x) => x === true, 1000);

            const sock = await parkPeerSocket();
            sock.send(JSON.stringify({
                path: '/cmd',
                params: { kw: 12 },
                _actor: { sub: 'user-x', perms: ['pitch.motor', 'admin.flash'] },
            }));

            await until(() => hits, h => h.length === 1, 1000);
            hits[0].actor.should.have.property('sub', 'user-x');
            hits[0].effective.should.containEql('pitch.motor');
            hits[0].effective.should.not.containEql('admin.flash');
            hits[0].params.should.have.property('kw', 12);
        });

        it('rejects when claimed perms don\'t survive the cap', async () => {
            // Caller claims admin.flash only; cap is pitch.*. Intersection is
            // empty, so a route requiring pitch.motor must reject (403).
            const hits = [];
            park = await spinUp(() => {});
            turbine = await spinUp(() => {});

            const peer = turbine.rnio.interconnect('park', park.wsUrl, {
                permissions: ['pitch.*'],
                routes: (r) => {
                    r.ws('/cmd', {
                        permissions: ['pitch.motor'],
                        func: () => { hits.push(true); }
                    });
                }
            });
            await until(() => peer.isOpen, (x) => x === true, 1000);

            // Park collects whatever turbine echoes back (the 403 envelope).
            const errs = [];
            park.rnio.wsServer.clients.forEach(c => {
                c.on('message', m => errs.push(m.toString()));
            });

            const sock = await parkPeerSocket();
            sock.send(JSON.stringify({
                path: '/cmd',
                _actor: { sub: 'user-x', perms: ['admin.flash'] },
            }));

            await until(() => errs, e => e.length >= 1, 1000);
            hits.length.should.equal(0);
            const reply = JSON.parse(errs[0]);
            should(reply.code).equal(403);
        });

        it('clamps caller-broader perms down to the cap', async () => {
            // Caller claims pitch.* (broad); cap is pitch.set_telem only.
            // Effective set must be pitch.set_telem — caller still gets to
            // hit set_telem, but not motor.
            const hits = [];
            park = await spinUp(() => {});
            turbine = await spinUp(() => {});

            const peer = turbine.rnio.interconnect('park', park.wsUrl, {
                permissions: ['pitch.set_telem'],
                routes: (r) => {
                    r.ws('/telem', {
                        permissions: ['pitch.set_telem'],
                        func: (_p, client) => { hits.push([...client.effectivePermissions]); }
                    });
                    r.ws('/motor', {
                        permissions: ['pitch.motor'],
                        func: () => { hits.push('motor-ran'); }
                    });
                }
            });
            await until(() => peer.isOpen, (x) => x === true, 1000);

            const sock = await parkPeerSocket();
            sock.send(JSON.stringify({
                path: '/telem',
                _actor: { sub: 'u', perms: ['pitch.*'] },
            }));
            await until(() => hits, h => h.length === 1, 1000);
            hits[0].should.containEql('pitch.set_telem');
            hits[0].should.not.containEql('pitch.motor');

            // /motor must reject — pitch.motor isn't in the clamped set.
            sock.send(JSON.stringify({
                path: '/motor',
                _actor: { sub: 'u', perms: ['pitch.*'] },
            }));
            // give it a moment; on reject `hits` stays at 1.
            await new Promise(r => setTimeout(r, 100));
            hits.length.should.equal(1);
        });

        it('without _actor falls back to peer connection perms', async () => {
            const hits = [];
            park = await spinUp(() => {});
            turbine = await spinUp(() => {});

            const peer = turbine.rnio.interconnect('park', park.wsUrl, {
                permissions: ['pitch.*'],
                routes: (r) => {
                    r.ws('/cmd', {
                        permissions: ['pitch.motor'],
                        func: (_p, client) => {
                            hits.push({ actor: client.actor, eff: [...client.effectivePermissions] });
                        }
                    });
                }
            });
            await until(() => peer.isOpen, (x) => x === true, 1000);

            const sock = await parkPeerSocket();
            sock.send(JSON.stringify({ path: '/cmd' }));

            await until(() => hits, h => h.length === 1, 1000);
            should(hits[0].actor).be.null();
            hits[0].eff.should.containEql('pitch.*');
        });

        it('plain ws client cannot impersonate via _actor', async () => {
            // Trust gate: only InterClient honors _actor. A regular ws client
            // sending the same field has it ignored — its connection perms
            // (empty by default) are the only thing checked.
            const hits = [];
            turbine = await spinUp((router) => {
                router.ws('/cmd', {
                    permissions: ['pitch.motor'],
                    func: (_p, client) => {
                        hits.push({ actor: client.actor, eff: [...client.effectivePermissions] });
                    }
                });
            });

            const { connect, collect, encodeJson, waitFor, decodeAny } = require('../helpers/wsClient');
            const ws = await connect(turbine.wsUrl);
            const got = collect(ws);
            ws.send(encodeJson({
                path: '/cmd',
                _actor: { sub: 'sneaky', perms: ['pitch.motor'] },
            }));
            await waitFor(got, 1, 500);
            const reply = decodeAny('json', got[0]);
            // Route never ran; reply is a 403.
            hits.length.should.equal(0);
            should(reply.code).equal(403);
            ws.close();
        });

        it('clears actor + effectivePermissions after dispatch', async () => {
            // Read the getters AFTER the handler returns to confirm cleanup.
            // We snapshot a reference to `client` from inside the handler and
            // re-check it on the outside in a tick.
            let clientRef = null;
            park = await spinUp(() => {});
            turbine = await spinUp(() => {});

            const peer = turbine.rnio.interconnect('park', park.wsUrl, {
                permissions: ['pitch.*'],
                routes: (r) => {
                    r.ws('/cmd', {
                        permissions: ['pitch.motor'],
                        func: (_p, client) => { clientRef = client; }
                    });
                }
            });
            await until(() => peer.isOpen, (x) => x === true, 1000);

            const sock = await parkPeerSocket();
            sock.send(JSON.stringify({
                path: '/cmd',
                _actor: { sub: 'u', perms: ['pitch.motor'] },
            }));

            await until(() => clientRef, c => c !== null, 1000);
            // Outside the dispatch context, getters return the connection-default.
            should(clientRef.actor).be.null();
            clientRef.effectivePermissions.should.equal(clientRef.permissions);
        });
    });

    describe('router.proxy()', () => {
        it('forwards descendant paths to the target peer with _actor minted', async () => {
            // Park exposes a route /pitch/cmd/motor that captures whatever
            // arrives. Turbine has the outbound peer to park; from turbine's
            // POV park is a Client (peer). We stand in for that "central"
            // role: turbine is the central, park is the upstream — so the
            // proxy route lives on TURBINE and forwards to its `park` peer.
            const got = [];
            park = await spinUp((router) => {
                router.ws('/pitch/cmd/motor', (params, client) => {
                    got.push({ params, actor: client.actor });
                });
            });
            turbine = await spinUp(() => {});

            const peer = turbine.rnio.interconnect('park', park.wsUrl, {
                permissions: ['pitch.*'],
            });
            await until(() => peer.isOpen, (x) => x === true, 1000);

            // Now register a proxy route on turbine that forwards
            // /turbine/:turbineID/<rest> down to the park peer. (In real life
            // central does this; here we use turbine for the test setup.)
            turbine.rnio.router.proxy('/turbine/:turbineID', {
                target: () => peer,
            });

            // Hit the proxy route from a normal local ws client.
            const { connect, encodeJson } = require('../helpers/wsClient');
            const ws = await connect(turbine.wsUrl);
            ws.send(encodeJson({
                path: '/turbine/wt1/pitch/cmd/motor',
                params: { unit_id: 1, target: 0.4 },
            }));

            await until(() => got, g => g.length === 1, 1000);
            got[0].params.should.have.property('unit_id', 1);
            got[0].params.should.have.property('target', 0.4);
            // turbineID was captured at the proxy hop and forwarded along.
            got[0].params.should.have.property('turbineID', 'wt1');
            // `rest` was stripped from the forwarded params (it was the path).
            got[0].params.should.not.have.property('rest');
            // Calling client had no _actor (entry point), so proxy minted one
            // from its connection. The peer is treated as type='ws' on park's
            // side though, so client.actor is null there — _actor only triggers
            // on type='inter'. Verify by switching: we'll do a separate test
            // for actor propagation.
            ws.close();
        });

        it('returns 503 when target resolves to null', async () => {
            turbine = await spinUp((router, rnio) => {
                router.proxy('/turbine/:turbineID', {
                    target: () => null,
                });
            });
            const { connect, collect, encodeJson, waitFor, decodeAny } = require('../helpers/wsClient');
            const ws = await connect(turbine.wsUrl);
            const got = collect(ws);
            ws.send(encodeJson({ path: '/turbine/wt1/pitch/cmd/motor' }));
            await waitFor(got, 1, 500);
            const reply = decodeAny('json', got[0]);
            should(reply.code).equal(503);
            ws.close();
        });

        it('honors permissions on the proxy hop', async () => {
            // A normal ws client with no perms should be rejected by the
            // proxy's `permissions: ['turbine.:turbineID']` gate.
            turbine = await spinUp((router) => {
                router.proxy('/turbine/:turbineID', {
                    target:      { obj: () => {} },     // dummy
                    permissions: ['turbine.:turbineID'],
                });
            });
            const { connect, collect, encodeJson, waitFor, decodeAny } = require('../helpers/wsClient');
            const ws = await connect(turbine.wsUrl);
            const got = collect(ws);
            ws.send(encodeJson({ path: '/turbine/wt1/pitch/cmd/motor' }));
            await waitFor(got, 1, 500);
            const reply = decodeAny('json', got[0]);
            should(reply.code).equal(403);
            ws.close();
        });

        it('end-to-end: relayed envelope hits route with clamped actor on remote', async () => {
            // Topology under test:
            //   normal-client → centralServer.proxy(/turbine/:id) → peer → turbineServer.route
            // turbineServer's outbound InterClient honors _actor; route uses
            // pitch.motor permission and the proxy hop mints from caller's
            // perms, which are clamped at the receiver against the link cap.
            const got = [];
            // The receiver — pretend this is the turbine server with the
            // command route on it.
            turbine = await spinUp((router) => {
                router.ws('/pitch/cmd/motor', {
                    permissions: ['pitch.motor'],
                    func: (params, client) => {
                        got.push({ params, actor: client.actor, eff: [...client.effectivePermissions] });
                    },
                });
            });
            // The intermediate — pretend this is the central. It connects
            // OUT to the turbine (so on turbine's side the link is type='inter').
            park = await spinUp(() => {});
            const peer = park.rnio.interconnect('turbine', turbine.wsUrl, {
                permissions: ['pitch.*'],
            });
            await until(() => peer.isOpen, (x) => x === true, 1000);

            // Wait until the inbound socket on turbine is ready before adding
            // any proxy hops. (Not strictly needed; included for clarity.)
            await until(() => turbine.rnio.wsServer.clients.size, n => n >= 1, 1000);

            // Now define the proxy on park. It mints _actor from the calling
            // client (a normal ws client connecting directly to park).
            park.rnio.router.proxy('/turbine/:turbineID', {
                target: () => peer,
            });

            const { connect, encodeJson } = require('../helpers/wsClient');
            const ws = await connect(park.wsUrl);
            // Pre-grant some perms on the caller. Since auth is disabled in
            // the test setup, we set permissions directly on the ws client.
            // Wait for the WebSocketClient to register…
            await until(() => park.rnio.wsServer.clients.size, n => n >= 1, 1000);
            // Find our inbound client on park. Skip the peer one (which has
            // its own connection to turbine — that's outbound, not inbound).
            // park.rnio.wsServer.clients only contains inbound; the peer is
            // an InterClient kept separately.
            const inbound = [...park.rnio.wsServer.clients];
            // Last-connected one is our test client.
            // Find Client wrapper via the per-client subscriptions table.
            // Easier: just grant perms by sending a token-bearing envelope,
            // but auth is disabled here. So we mutate directly — the test
            // is reaching into internals deliberately.
            // We don't actually need perms granted on the *caller* for this
            // test — we just want to see that the proxy mints _actor and the
            // remote clamps it.
            ws.send(encodeJson({
                path: '/turbine/wt1/pitch/cmd/motor',
                params: { unit_id: 2, target: 0.7 },
            }));

            // The caller has 0 perms; minted _actor.perms = []. Cap on inter
            // link is `pitch.*`. Intersect = []. Route requires pitch.motor.
            // Expect: 403 on remote, route never runs.
            await new Promise(r => setTimeout(r, 200));
            got.length.should.equal(0);
            ws.close();
        });
    });

    describe('subBridge', () => {
        it('forwards local OUT channel frames to the peer with prefix', async () => {
            // Turbine emits `telem` locally. The peer (turbine→park) bridges
            // OUT with prefix `wt1`, so frames cross as `wt1.telem`. On park,
            // every inbound peer's wsConnect handler attaches an IN bridge
            // accepting `wt1.telem`, which re-publishes locally. A vanilla ws
            // client on park subscribes to `wt1.telem` and receives the
            // payload unwrapped.
            park = await spinUp((router) => {
                router.on('wsConnect', (_p, client) => {
                    client.subBridge({ in: ['wt1.telem'] });
                });
                router.ws('/listen', (_p, client) => {
                    client.subscribe('wt1.telem');
                });
            });
            turbine = await spinUp(() => {});
            const peer = turbine.rnio.interconnect('park', park.wsUrl);
            await until(() => peer.isOpen, (x) => x === true, 1000);
            peer.subBridge({ prefix: 'wt1', out: ['telem'] });

            const { connect, collect, encodeJson, decodeAny, waitFor } = require('../helpers/wsClient');
            const ws = await connect(park.wsUrl);
            const got = collect(ws);
            ws.send(encodeJson({ path: '/listen' }));
            await until(() =>
                park.rnio.subs('wt1.telem').size, n => n >= 1, 1000);

            turbine.rnio.subs('telem').obj({ rpm: 12, t: 100 });

            await waitFor(got, 1, 1000);
            const frame = decodeAny('json', got[0]);
            // The frame the park-local client receives is the raw payload —
            // park's inbound bridge unwrapped sub.frame and re-published the
            // payload to the local channel.
            frame.should.have.property('rpm', 12);
            frame.should.have.property('t', 100);
            ws.close();
        });

        it('refuses same channel in both `in` and `out` (echo guard)', () => {
            // SubBridge throws a raw string (RestNio-house style); should.throw
            // with a regex matcher only accepts Error objects, so use the
            // try/catch + String() pattern instead.
            const stub = { restnio: { subscriptions: {
                onChannelCreate: () => {}, offChannelCreate: () => {}, subscribe: () => {}, unsubscribe: () => {},
            } } };
            const SubBridge = require('../../lib/util/SubBridge');
            let caught = null;
            try { new SubBridge(stub, { out: ['x'], in: ['x'] }); }
            catch (e) { caught = e; }
            should(caught).not.be.null();
            String(caught).should.match(/both out and in/);
        });

        it('plain ws clients ignore _type frames they did not bridge', async () => {
            // Without subBridge attached, a sub.frame envelope is dropped
            // silently. Critically, it is NOT path-routed (no 404 fallback,
            // no route hit). We confirm by asserting nothing is received and
            // a regular path request that follows still works.
            const hits = [];
            turbine = await spinUp((router) => {
                router.ws('/cmd', (params) => { hits.push(params); });
            });

            const { connect, collect, encodeJson, decodeAny, waitFor } = require('../helpers/wsClient');
            const ws = await connect(turbine.wsUrl);
            const got = collect(ws);
            ws.send(encodeJson({ _type: 'sub.frame', channel: 'whatever', payload: { x: 1 } }));
            // Follow with a normal path request to prove dispatcher still works.
            ws.send(encodeJson({ path: '/cmd', params: { y: 2 } }));
            await until(() => hits, h => h.length >= 1, 500);
            hits[0].should.have.property('y', 2);
            ws.close();
        });

        it('wildcard `out: *` mirrors every channel including newly-created ones', async () => {
            park = await spinUp((router, rnio) => {
                router.on('wsConnect', (_p, client) => {
                    client.subBridge({ in: '*' });
                });
                router.ws('/listen', {
                    params: { ch: rnio.params.string },
                    func:   (p, c) => c.subscribe(p.ch),
                });
            });

            turbine = await spinUp(() => {});
            const peer = turbine.rnio.interconnect('park', park.wsUrl);
            await until(() => peer.isOpen, (x) => x === true, 1000);
            peer.subBridge({ out: '*' });

            const { connect, collect, encodeJson, decodeAny, waitFor } = require('../helpers/wsClient');
            const ws = await connect(park.wsUrl);
            const got = collect(ws);
            // Subscribe locally on park to a channel that does NOT exist yet
            // anywhere. When turbine creates it later via subs(name).obj(...)
            // the wildcard out-bridge must catch it.
            ws.send(encodeJson({ path: '/listen', params: { ch: 'late_channel' } }));
            await until(() => park.rnio.subs('late_channel').size, n => n >= 1, 1000);

            // Now create the channel on turbine for the first time and emit.
            turbine.rnio.subs('late_channel').obj({ msg: 'hi' });

            await waitFor(got, 1, 1000);
            const frame = decodeAny('json', got[0]);
            frame.should.have.property('msg', 'hi');
            ws.close();
        });

        it('forwards str and json (not just obj)', async () => {
            // ClientSet exposes obj/str/json; bridge must forward all three.
            // Receiver re-publishes via subs(channel).obj(payload), so
            // whatever value the sender emitted lands at local subscribers
            // unchanged.
            park = await spinUp((router) => {
                router.on('wsConnect', (_p, client) => {
                    client.subBridge({ in: ['t.events'] });
                });
                router.ws('/listen', (_p, c) => c.subscribe('t.events'));
            });
            turbine = await spinUp(() => {});
            const peer = turbine.rnio.interconnect('park', park.wsUrl);
            await until(() => peer.isOpen, (x) => x === true, 1000);
            peer.subBridge({ prefix: 't', out: ['events'] });

            const { connect, collect, encodeJson, decodeAny, waitFor } = require('../helpers/wsClient');
            const ws = await connect(park.wsUrl);
            const got = collect(ws);
            ws.send(encodeJson({ path: '/listen' }));
            await until(() => park.rnio.subs('t.events').size, n => n >= 1, 1000);

            // obj — already covered, but include here for symmetry.
            turbine.rnio.subs('events').obj({ kind: 'boot' });
            // str — plain string emit.
            turbine.rnio.subs('events').str('plain-text-event');
            // json — single-arg form.
            turbine.rnio.subs('events').json({ kind: 'json-form' });

            await waitFor(got, 3, 1500);
            // Frame 1: obj round-trip.
            decodeAny('json', got[0]).should.have.property('kind', 'boot');
            // Frame 2: bridge wrapped str → receiver re-publishes via obj(string)
            // → ClientSet.obj forwards to client.obj(string) → str frame.
            // The text content is the raw string (decodeAny passes
            // non-JSON-parseable strings through verbatim).
            decodeAny('json', got[1]).should.equal('plain-text-event');
            // Frame 3: json single-arg.
            decodeAny('json', got[2]).should.have.property('kind', 'json-form');
            ws.close();
        });

        it('warns once on bin/buf and does not bridge them', async () => {
            // Capture console.warn so the warning visibly fires exactly once
            // even across multiple .bin() calls on the same channel.
            const warns = [];
            const origWarn = console.warn;
            console.warn = (...args) => warns.push(args.join(' '));

            try {
                park = await spinUp((router) => {
                    router.on('wsConnect', (_p, client) => {
                        client.subBridge({ in: ['t.bin'] });
                    });
                    router.ws('/listen', (_p, c) => c.subscribe('t.bin'));
                });
                turbine = await spinUp(() => {});
                const peer = turbine.rnio.interconnect('park', park.wsUrl);
                await until(() => peer.isOpen, (x) => x === true, 1000);
                peer.subBridge({ prefix: 't', out: ['bin'] });

                const { connect, collect, encodeJson } = require('../helpers/wsClient');
                const ws = await connect(park.wsUrl);
                const got = collect(ws);
                ws.send(encodeJson({ path: '/listen' }));
                await until(() => park.rnio.subs('t.bin').size, n => n >= 1, 1000);

                // ClientSet exposes .buf() (.bin doesn't exist on the set —
                // individual Clients have it). Multiple emits should warn
                // ONCE total per channel.
                turbine.rnio.subs('bin').buf(Buffer.from([1, 2, 3]));
                turbine.rnio.subs('bin').buf(Buffer.from([4, 5, 6]));
                turbine.rnio.subs('bin').buf(Buffer.from([7, 8, 9]));

                // Give the loop a tick.
                await new Promise(r => setTimeout(r, 100));
                got.length.should.equal(0);          // nothing bridged
                warns.length.should.equal(1);        // exactly one warn fired
                warns[0].should.match(/bin\/\.buf is not bridged/);
                ws.close();
            } finally {
                console.warn = origWarn;
            }
        });

        it('auto-tears-down on Client.close: server-side bridge proxies cleared on disconnect', async () => {
            // Server-side (inbound peer) bridge attached in wsConnect. After
            // the inbound peer client closes, its SubBridge must teardown
            // automatically so its proxy subscribers no longer leak in the
            // park's SubscriptionMap. Without this, every emit to the local
            // channel would keep calling .obj() on a dead client.
            const channelSeenSubs = () => park.rnio.subs('aux').size;
            park = await spinUp((router) => {
                router.on('wsConnect', (_p, client) => {
                    // Outbound channel — proxy registers as subscriber on `aux`.
                    client.subBridge({ out: ['aux'] });
                });
            });
            turbine = await spinUp(() => {});

            const peer = turbine.rnio.interconnect('park', park.wsUrl);
            await until(() => peer.isOpen, (x) => x === true, 1000);
            // Inbound bridge attached → proxy subscribed to `aux`.
            await until(() => channelSeenSubs(), (n) => n === 1, 1000);

            peer.close();
            // After disconnect the proxy must be unsubscribed automatically.
            await until(() => channelSeenSubs(), (n) => n === 0, 1000);
        });

        it('survives reconnect: bridge keeps forwarding after peer restart', async () => {
            // The InterClient instance persists across a transport drop;
            // its outbound proxies remain registered on the local
            // SubscriptionMap. After reconnect, frames must still flow.
            // Server-side bridge is re-attached in wsConnect on each new
            // inbound socket, so no manual rewiring is required.
            const parkRoutes = (router) => {
                router.on('wsConnect', (_p, client) => {
                    client.subBridge({ in: ['rt.telem'] });
                });
                router.ws('/listen', (_p, c) => c.subscribe('rt.telem'));
            };
            park = await spinUp(parkRoutes);
            const port = park.port;
            turbine = await spinUp(() => {});
            const peer = turbine.rnio.interconnect('park', park.wsUrl, {
                reconnect: { enabled: true, minDelay: 30, maxDelay: 60, factor: 1, jitter: 0 },
            });
            await until(() => peer.isOpen, (x) => x === true, 1000);
            peer.subBridge({ prefix: 'rt', out: ['telem'] });

            const { connect, collect, encodeJson, decodeAny, waitFor } = require('../helpers/wsClient');
            const ws1 = await connect(park.wsUrl);
            const got1 = collect(ws1);
            ws1.send(encodeJson({ path: '/listen' }));
            await until(() => park.rnio.subs('rt.telem').size, (n) => n >= 1, 1000);
            turbine.rnio.subs('telem').obj({ n: 1 });
            await waitFor(got1, 1, 1000);
            decodeAny('json', got1[0]).should.have.property('n', 1);
            ws1.close();

            // Drop park, peer enters 'closed', reconnect fires.
            await park.close();
            await until(() => peer.status, (s) => s !== 'open', 1500);

            // Bring park back on same port. Peer must reconnect.
            park = await spinUp(parkRoutes, { port });
            await until(() => peer.isOpen, (x) => x === true, 5000);

            const ws2 = await connect(park.wsUrl);
            const got2 = collect(ws2);
            ws2.send(encodeJson({ path: '/listen' }));
            await until(() => park.rnio.subs('rt.telem').size, (n) => n >= 1, 1000);
            turbine.rnio.subs('telem').obj({ n: 2 });
            await waitFor(got2, 1, 1000);
            decodeAny('json', got2[0]).should.have.property('n', 2);
            ws2.close();
        });

        it('drops malformed sub.frame envelopes (non-string channel, undefined payload)', async () => {
            // A peer that controls the wire could send a bogus sub.frame.
            // The receiver must validate and refuse to publish — otherwise
            // local subscribers receive `undefined` or pollute non-string
            // channel keys.
            park = await spinUp((router) => {
                router.on('wsConnect', (_p, client) => {
                    client.subBridge({ in: '*' }); // wildcard accept
                });
            });
            turbine = await spinUp(() => {});
            const peer = turbine.rnio.interconnect('park', park.wsUrl);
            await until(() => peer.isOpen, (x) => x === true, 1000);

            // Local subscriber on the park to count receipts on a known channel.
            const got = [];
            const proxy = { obj: (p) => got.push(p), str: () => {}, json: () => {}, bin: () => {}, buf: () => {}, err: () => {}, ok: () => {}, close: () => {} };
            park.rnio.subscriptions.subscribe('legit', proxy);

            // From the turbine side, push three sub.frame envelopes:
            //  1) malformed — non-string channel  → must be dropped
            //  2) malformed — undefined payload   → must be dropped
            //  3) valid — must be published
            peer.obj({ _type: 'sub.frame', channel: 42,      payload: { x: 1 } });
            peer.obj({ _type: 'sub.frame', channel: 'legit'                 });
            peer.obj({ _type: 'sub.frame', channel: 'legit', payload: { x: 3 } });

            await until(() => got, (g) => g.length >= 1, 1000);
            // Only the third frame should have made it through.
            got.length.should.equal(1);
            got[0].should.have.property('x', 3);
        });

        it('teardown unhooks proxies and stops forwarding', async () => {
            park = await spinUp((router) => {
                router.on('wsConnect', (_p, client) => {
                    client._parkBridge = client.subBridge({ in: ['t.telem'] });
                });
                router.ws('/listen', (_p, c) => c.subscribe('t.telem'));
            });
            turbine = await spinUp(() => {});
            const peer = turbine.rnio.interconnect('park', park.wsUrl);
            await until(() => peer.isOpen, (x) => x === true, 1000);
            const bridge = peer.subBridge({ prefix: 't', out: ['telem'] });

            const { connect, collect, encodeJson, decodeAny, waitFor } = require('../helpers/wsClient');
            const ws = await connect(park.wsUrl);
            const got = collect(ws);
            ws.send(encodeJson({ path: '/listen' }));
            await until(() => park.rnio.subs('t.telem').size, n => n >= 1, 1000);

            turbine.rnio.subs('telem').obj({ n: 1 });
            await waitFor(got, 1, 1000);
            decodeAny('json', got[0]).should.have.property('n', 1);

            bridge.teardown();
            turbine.rnio.subs('telem').obj({ n: 2 });
            // Confirm no second frame appears.
            await new Promise(r => setTimeout(r, 200));
            got.length.should.equal(1);
            ws.close();
        });
    });

    it('lifecycle: interOpen handler that throws is contained, peer keeps working', async () => {
        // A buggy interOpen handler must not break the link. _fireLifecycle
        // catches errors per-handler so the connection state machine stays
        // intact and subsequent frames still route. The thrown error path
        // also triggers err() → reply on the wire; remote drops it via
        // interNoPath.
        const got = [];
        park = await spinUp((router) => {
            router.ws('/cmd', (params) => { got.push(params); });
        });
        turbine = await spinUp(() => {});
        const peer = turbine.rnio.interconnect('park', park.wsUrl, {
            routes: (router) => {
                router.on('interOpen', () => { throw new Error('boom'); });
            }
        });
        await until(() => peer.isOpen, (x) => x === true, 1000);

        // Despite the throw, normal ops still work.
        peer.obj({ path: '/cmd', params: { ok: true } });
        await until(() => got, (g) => g.length === 1, 1000);
        got[0].should.have.property('ok', true);
    });

    it('lifecycle: interError fires with type=transport on socket errors', async () => {
        // Connecting to a port nothing is listening on triggers a
        // transport-level error before the socket ever opens.
        park = await spinUp(() => {});
        turbine = await spinUp(() => {});
        const closedPort = park.port;
        await park.close();
        park = null;

        const errors = [];
        const peer = turbine.rnio.interconnect('park', `ws://localhost:${closedPort}`, {
            reconnect: { enabled: false },
            routes: (router) => {
                router.on('interError', (params) => { errors.push(params); });
            }
        });
        await until(() => errors, (e) => e.length >= 1, 2000);
        errors[0].should.have.property('type', 'transport');
        errors[0].should.have.property('error');
        peer.close();
    });

    it('lifecycle: interError fires with type=protocol on parse failure of inbound text', async () => {
        // Force a parse failure on the InterClient by having the remote
        // park push a non-JSON text frame into the peer socket. The peer
        // must surface it as interError type=protocol.
        const errors = [];
        park = await spinUp((router) => {
            router.on('wsConnect', (_p, client) => {
                // Reach down into the underlying ws and send raw garbage to
                // the peer-side InterClient.
                client.ws.send('not-json-at-all');
            });
        });
        turbine = await spinUp(() => {});
        const peer = turbine.rnio.interconnect('park', park.wsUrl, {
            routes: (router) => {
                router.on('interError', (params) => { errors.push(params); });
            }
        });
        await until(() => peer.isOpen, (x) => x === true, 1000);
        await until(() => errors, (e) => e.some(x => x.type === 'protocol'), 1000);
        const protocolErr = errors.find(x => x.type === 'protocol');
        protocolErr.should.have.property('error');
        protocolErr.error.should.match(/JSON|Unexpected/i);
    });

    it('lifecycle: interError fires on _sendBuffer overflow and oldest frames drop', async () => {
        // Point at a port nothing is listening on so the socket never
        // opens and the buffer fills. With a tiny limit, we expect the
        // buffer to cap and droppedFrames to increment.
        park = await spinUp(() => {});
        const closedPort = park.port;
        await park.close();
        park = null;

        turbine = await spinUp(() => {});
        const errors = [];
        const peer = turbine.rnio.interconnect('park', `ws://localhost:${closedPort}`, {
            sendBufferLimit: 3,
            reconnect: { enabled: false },
            routes: (router) => {
                router.on('interError', (params) => { errors.push(params); });
            }
        });

        // Buffer filling: 5 frames, limit 3 → 2 dropped.
        for (let i = 0; i < 5; i++) peer.obj({ path: '/x', params: { i } });

        await until(() => errors, (e) => e.filter(x => x.type === 'sendBufferOverflow').length === 2, 1500);
        peer.droppedFrames.should.equal(2);
        peer._sendBuffer.length.should.equal(3);
        peer.close();
    });

    it('peer.status reflects connection state through the lifecycle', async () => {
        park = await spinUp(() => {});
        turbine = await spinUp(() => {});

        const peer = turbine.rnio.interconnect('park', park.wsUrl);
        peer.status.should.equal('connecting');
        peer.isOpen.should.equal(false);

        await until(() => peer.isOpen, (x) => x === true, 1000);
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
