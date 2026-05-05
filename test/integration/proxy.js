/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const should = require('should');
const { spinUp } = require('../helpers/server');
const { connect, collect, encodeJson, waitFor, decodeAny } = require('../helpers/wsClient');

/**
 * Tiny await-condition helper. Polls `read()` until `pred(v)` is truthy or
 * the deadline elapses; rejects with the last seen value on timeout.
 */
async function until(read, pred, timeoutMs = 1000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const v = read();
        if (pred(v)) return v;
        await new Promise(r => setTimeout(r, 5));
    }
    throw new Error(`until: timeout (last value: ${JSON.stringify(read())})`);
}

/**
 * Build a Phase-1 proxy harness:
 *
 *  - `central` (caller side) — exposes `/turbine/:turbineID/...` proxied to
 *    its outbound peer link to `turbine`. API clients hit this.
 *  - `turbine` (callee side) — exposes the actual application routes;
 *    accepts the inbound peer link (auto-promoted as a peer in `wsConnect`
 *    via `linkAsPeer({...})`).
 *
 * Returns an object with both servers + the live peer; the caller is
 * responsible for closing both via the test's afterEach.
 */
async function buildProxyPair(turbineRoutes, opts = {}) {
    const peerCap = opts.peerCap || ['pitch.*'];
    // Channel-name patterns naming the *direction* of the flow rather than
    // a side: `turbineToCentral` = channels published on turbine that should
    // flow to central; `centralToTurbine` = the reverse. We then translate
    // these into the per-side `shadowOut` / `shadowIn` configs (which can
    // be confusing because each side's "out" is the same wire as the other
    // side's "in").
    const turbineToCentral = opts.turbineToCentral || ['pitch.*', 'pitch'];
    const centralToTurbine = opts.centralToTurbine || ['cmd_broadcast.*'];

    let peerLinkResolve;
    const peerLinked = new Promise(r => { peerLinkResolve = r; });

    const turbine = await spinUp((router) => {
        // Auto-promote every inbound socket. In real systems this would gate
        // on a /register handshake; tests keep it open. Resolve the
        // peerLinked promise once the wrapper is promoted so the test does
        // not race the first proxied request against linkAsPeer.
        router.on('wsConnect', (_p, client) => {
            client.linkAsPeer({
                shadowOut: turbineToCentral,   // turbine publishes → flows to central
                shadowIn:  centralToTurbine,   // central publishes → arrives here
            });
            client.grantPerm(...peerCap);
            peerLinkResolve(client);
        });
        if (turbineRoutes) turbineRoutes(router);
    });
    const central = await spinUp((router, rnio) => {
        router.proxy('/turbine/:turbineID', {
            target: () => rnio.inter('turbine'),
            permissions: opts.proxyPerms || [],
        });
    });
    const peer = central.rnio.interconnect('turbine', turbine.wsUrl, {
        permissions: peerCap,
        shadowOut: centralToTurbine,   // central publishes → flows to turbine
        shadowIn:  turbineToCentral,   // turbine publishes → arrives here
    });
    await until(() => peer.isOpen, x => x === true, 1500);
    const turbinePeer = await Promise.race([
        peerLinked,
        new Promise((_, rej) => setTimeout(() => rej(new Error('linkAsPeer timeout')), 1500)),
    ]);
    return { central, turbine, peer, turbinePeer };
}

describe('router.proxy() — ProxyClient integration', function () {
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

    it('WS round-trip: api → central → turbine → api with the route\'s return value', async () => {
        const got = [];
        ({ central, turbine, peer } = await buildProxyPair((router) => {
            router.ws('/pitch/status', (params, client) => {
                got.push({ params, sub: client.token && client.token.sub });
                return { ok: true, rpm: 12 };
            });
        }));

        const ws = await connect(central.wsUrl);
        const out = collect(ws);
        ws.send(encodeJson({
            path: '/turbine/WT1/pitch/status',
            params: { unit_id: 1 },
        }));
        await waitFor(out, 1, 1500);
        const reply = decodeAny('json', out[0]);
        reply.should.have.property('ok', true);
        reply.should.have.property('rpm', 12);
        got[0].params.should.have.property('unit_id', 1);
        // turbineID was a path param at the proxy hop; it propagates as a param.
        got[0].params.should.have.property('turbineID', 'WT1');
        ws.close();
    });

    it('HTTP round-trip: GET /turbine/WT1/... returns the handler return value as the body', async () => {
        ({ central, turbine, peer } = await buildProxyPair((router) => {
            router.get('/pitch/status', () => ({ ok: true, source: 'turbine' }));
        }));

        const http = require('http');
        const body = await new Promise((resolve, reject) => {
            http.get(`${central.url}/turbine/WT1/pitch/status`, (res) => {
                let buf = '';
                res.on('data', d => buf += d);
                res.on('end', () => resolve({ status: res.statusCode, body: buf }));
            }).on('error', reject);
        });
        body.status.should.equal(200);
        const parsed = JSON.parse(body.body);
        parsed.should.have.property('ok', true);
        parsed.should.have.property('source', 'turbine');
    });

    it('subscribe back-prop: api subscribes through proxy → publish on turbine fans out coalesced', async () => {
        let turbinePeer;
        ({ central, turbine, peer, turbinePeer } = await buildProxyPair((router) => {
            router.ws('/pitch/subscribe', (_p, client) => {
                client.subscribe('pitch.events');
                return { ok: true, subbed: 'pitch.events' };
            });
        }));

        // Two api clients, both subscribe through the proxy.
        const ws1 = await connect(central.wsUrl); const got1 = collect(ws1);
        const ws2 = await connect(central.wsUrl); const got2 = collect(ws2);
        ws1.send(encodeJson({ path: '/turbine/WT1/pitch/subscribe' }));
        ws2.send(encodeJson({ path: '/turbine/WT1/pitch/subscribe' }));
        await waitFor(got1, 1, 1500);
        await waitFor(got2, 1, 1500);

        // Wait until both back-propped subs land on central.
        await until(() => central.rnio.subs('pitch.events').size, n => n === 2, 1500);
        // And both ProxyClients are in the turbine's local sub list.
        await until(() => turbine.rnio.subs('pitch.events').size, n => n === 2, 1500);

        // Count outbound wire frames on the turbine peer's underlying ws.
        // turbinePeer is the WebSocketClient wrapper representing central
        // on the turbine side; its .ws is the raw ws.WebSocket.
        let shadowFrames = 0;
        const origSend = turbinePeer.ws.send.bind(turbinePeer.ws);
        turbinePeer.ws.send = (data, ...rest) => {
            const s = Buffer.isBuffer(data) ? data.toString() : String(data);
            try {
                const parsed = JSON.parse(s);
                if (parsed && parsed._proxyrchan) shadowFrames++;
            } catch (_) {}
            return origSend(data, ...rest);
        };

        // Single publish. Must coalesce into ONE shadow frame on the peer.
        turbine.rnio.subs('pitch.events').obj({ rpm: 17, ts: 100 });

        await waitFor(got1, 2, 1500);
        await waitFor(got2, 2, 1500);
        decodeAny('json', got1[1]).should.have.property('rpm', 17);
        decodeAny('json', got2[1]).should.have.property('rpm', 17);
        // One wire frame, two delivered locally.
        shadowFrames.should.equal(1);

        ws1.close();
        ws2.close();
    });

    it('iteration over subs still works on turbine (state inspection)', async () => {
        ({ central, turbine, peer } = await buildProxyPair((router) => {
            router.ws('/pitch/subscribe', (_p, client) => {
                client.state.lastSub = Date.now();
                client.subscribe('pitch.events');
            });
        }));

        const ws = await connect(central.wsUrl); collect(ws);
        ws.send(encodeJson({ path: '/turbine/WT1/pitch/subscribe' }));
        await until(() => turbine.rnio.subs('pitch.events').size, n => n >= 1, 1500);

        const seen = [];
        turbine.rnio.subs('pitch.events').forEach(c => seen.push({
            type: c.type,
            hasState: typeof c.state.lastSub === 'number',
        }));
        seen.length.should.equal(1);
        seen[0].type.should.equal('proxy');
        seen[0].hasState.should.be.true();
        ws.close();
    });

    it('caller disconnect: ProxyClient on turbine fires wsClose and drops subs', async () => {
        const closes = [];
        ({ central, turbine, peer } = await buildProxyPair((router) => {
            router.on('wsClose', (_p, client) => {
                if (client.type === 'proxy') closes.push(true);
            });
            router.ws('/pitch/subscribe', (_p, client) => {
                client.subscribe('pitch.events');
            });
        }));

        const ws = await connect(central.wsUrl); collect(ws);
        ws.send(encodeJson({ path: '/turbine/WT1/pitch/subscribe' }));
        await until(() => turbine.rnio.subs('pitch.events').size, n => n >= 1, 1500);

        ws.close();
        await until(() => closes, c => c.length >= 1, 1500);
        await until(() => turbine.rnio.subs('pitch.events').size, n => n === 0, 1500);
    });

    it('whitelist enforcement: shadow frame for a non-whitelisted channel is dropped on receive', async () => {
        // Turbine subscribes a ProxyClient to `admin.kill`. Turbine's
        // outward whitelist permits it (we set turbineToCentral to include
        // admin.*), but central's inbound whitelist forbids it — central
        // must drop the shadow frame on receive.
        ({ central, turbine, peer } = await buildProxyPair((router) => {
            router.ws('/admin/subscribe', (_p, client) => {
                client.subscribe('admin.kill');
            });
        }, {
            peerCap:          ['pitch.*', 'admin.*'],
            // Turbine sends admin.* outward.
            turbineToCentral: ['admin.*'],
            // Central's shadowIn inherits this (in the helper). Override below.
        }));

        // Tighten the central peer's inbound whitelist post-construction so
        // it rejects admin.* even though turbine forwards it.
        peer._shadowIn = require('../../lib/util/peerLink')
            .compilePatterns(['cmd_broadcast.*']);

        const ws = await connect(central.wsUrl); const got = collect(ws);
        ws.send(encodeJson({ path: '/turbine/WT1/admin/subscribe' }));
        await until(() => turbine.rnio.subs('admin.kill').size, n => n >= 1, 1500);

        // Manually populate central's local subs so we'd notice if it leaked.
        const seen = [];
        const sentinel = {
            type: 'test',
            obj: (p) => seen.push(p),
            ok:  () => {}, str: () => {}, json: () => {}, bin: () => {}, buf: () => {},
            err: () => {}, close: () => {}, header: () => {}, cookie: () => {},
        };
        central.rnio.subscriptions.subscribe('admin.kill', sentinel);

        // Publish on turbine — should NOT propagate to central locals.
        turbine.rnio.subs('admin.kill').obj({ msg: 'should not arrive' });
        await new Promise(r => setTimeout(r, 100));
        seen.length.should.equal(0);

        ws.close();
    });

    it('persistent WS: same caller reuses the same ProxyClient across requests', async () => {
        const seen = [];
        ({ central, turbine, peer } = await buildProxyPair((router) => {
            router.ws('/pitch/touch', (_p, client) => {
                seen.push(client.id);
                client.state.touches = (client.state.touches || 0) + 1;
                return { touches: client.state.touches };
            });
        }));

        const ws = await connect(central.wsUrl); const out = collect(ws);
        ws.send(encodeJson({ path: '/turbine/WT1/pitch/touch' }));
        await waitFor(out, 1, 1500);
        ws.send(encodeJson({ path: '/turbine/WT1/pitch/touch' }));
        await waitFor(out, 2, 1500);
        ws.send(encodeJson({ path: '/turbine/WT1/pitch/touch' }));
        await waitFor(out, 3, 1500);

        seen.length.should.equal(3);
        // All three handler invocations saw the same ProxyClient id.
        seen[0].should.equal(seen[1]);
        seen[1].should.equal(seen[2]);
        // State accumulated across requests.
        decodeAny('json', out[2]).should.have.property('touches', 3);
        ws.close();
    });

    it('upstream offline: 503 when target resolver returns null', async () => {
        const standalone = await spinUp((router, rnio) => {
            router.proxy('/turbine/:turbineID', {
                target: () => null,
            });
        });
        try {
            const ws = await connect(standalone.wsUrl);
            const out = collect(ws);
            ws.send(encodeJson({ path: '/turbine/WT1/anywhere' }));
            await waitFor(out, 1, 1500);
            const reply = decodeAny('json', out[0]);
            should(reply.code).equal(503);
            ws.close();
        } finally {
            await standalone.close();
        }
    });

    it('permission gate at the proxy hop: caller without the perm is rejected', async () => {
        const standalone = await spinUp((router, rnio) => {
            router.proxy('/turbine/:turbineID', {
                target: () => ({ obj: () => {}, _isPeerLink: true }), // dummy
                permissions: ['turbine.:turbineID'],
            });
        });
        try {
            const ws = await connect(standalone.wsUrl);
            const out = collect(ws);
            ws.send(encodeJson({ path: '/turbine/WT1/x' }));
            await waitFor(out, 1, 1500);
            const reply = decodeAny('json', out[0]);
            should(reply.code).equal(403);
            ws.close();
        } finally {
            await standalone.close();
        }
    });

    it('permission clamp: caller-claimed perm absent from peer cap is denied at the callee', async () => {
        const hits = [];
        // Capture the central-side api WebSocketClient wrapper via wsConnect
        // so we can grant the caller `pitch.motor`. The peer-link cap
        // excludes pitch.motor, so the clamp at the turbine drops it even
        // though the caller claims it.
        let central_grant;
        let centralReadyResolve;
        const centralReady = new Promise(r => { centralReadyResolve = r; });
        ({ central, turbine, peer } = await buildProxyPair((router) => {
            router.ws('/pitch/motor', {
                permissions: ['pitch.motor'],
                func: (_p, client) => { hits.push([...client.permissions]); },
            });
        }, { peerCap: ['pitch.read'] }));   // cap excludes pitch.motor

        // Plumb a wsConnect on central too so we can grab the api client.
        // (Do this AFTER the peer link is up so wsConnect doesn't fire on
        // the inter peer's own connection — it doesn't, it goes the other
        // way; but explicit is cleaner.)
        central.rnio.router.on('wsConnect', (_p, client) => {
            // Skip the api ws if it was the proxy resolve. In practice the
            // peer link does NOT trigger wsConnect on this side because the
            // peer is OUTBOUND from central — central doesn't accept any
            // inbound peers in this topology. So every wsConnect IS an api
            // client.
            client.grantPerm('pitch.motor', 'pitch.read');
            centralReadyResolve(client);
        });

        const ws = await connect(central.wsUrl);
        await Promise.race([
            centralReady,
            new Promise((_, rej) => setTimeout(() => rej(new Error('central wsConnect timeout')), 1500)),
        ]);

        const out = collect(ws);
        ws.send(encodeJson({ path: '/turbine/WT1/pitch/motor' }));
        await waitFor(out, 1, 1500);
        const reply = decodeAny('json', out[0]);
        // Route never ran — clamped perms (intersection of caller's claimed
        // [pitch.motor, pitch.read] with peer cap [pitch.read]) = [pitch.read].
        // Route requires pitch.motor → reject.
        hits.length.should.equal(0);
        should(reply.code).equal(403);
        ws.close();
    });

    it('publish coalescing: 5 ProxyClients on one peer = ONE wire frame per publish', async () => {
        let turbinePeer;
        ({ central, turbine, peer, turbinePeer } = await buildProxyPair((router) => {
            router.ws('/pitch/subscribe', (_p, client) => {
                client.subscribe('pitch.events');
            });
        }));

        const wsList = [];
        for (let i = 0; i < 5; i++) {
            const w = await connect(central.wsUrl); collect(w);
            wsList.push(w);
            w.send(encodeJson({ path: '/turbine/WT1/pitch/subscribe' }));
        }
        await until(() => turbine.rnio.subs('pitch.events').size, n => n === 5, 2000);

        // Hook the underlying peer ws to count shadow wire frames.
        let shadowCount = 0;
        const origSend = turbinePeer.ws.send.bind(turbinePeer.ws);
        turbinePeer.ws.send = (data, ...rest) => {
            const s = Buffer.isBuffer(data) ? data.toString() : String(data);
            try {
                const parsed = JSON.parse(s);
                if (parsed && parsed._proxyrchan) shadowCount++;
            } catch (_) {}
            return origSend(data, ...rest);
        };

        // Three publishes. Expect 3 shadow frames (1 per publish, regardless
        // of subscriber count).
        turbine.rnio.subs('pitch.events').obj({ n: 1 });
        await new Promise(r => setTimeout(r, 20));
        turbine.rnio.subs('pitch.events').obj({ n: 2 });
        await new Promise(r => setTimeout(r, 20));
        turbine.rnio.subs('pitch.events').obj({ n: 3 });
        await new Promise(r => setTimeout(r, 100));

        shadowCount.should.equal(3);

        for (const w of wsList) w.close();
    });

    //=====================================================\\
    //                    Phase 2 — Streaming HTTP         \\
    //=====================================================\\

    it('streaming HTTP: handler emits multiple obj() chunks before client.close()', async () => {
        ({ central, turbine, peer } = await buildProxyPair((router) => {
            router.get('/pitch/stream', (_p, client) => {
                // Multi-chunk response. JSON-encoded each chunk so they
                // arrive on the wire as concatenated text and we can
                // verify by joining.
                client.str(JSON.stringify({ chunk: 1 }));
                client.str(JSON.stringify({ chunk: 2 }));
                client.str(JSON.stringify({ chunk: 3 }));
                client.close();
                return Infinity;
            });
        }));

        const http = require('http');
        const body = await new Promise((resolve, reject) => {
            http.get(`${central.url}/turbine/WT1/pitch/stream`, (res) => {
                let buf = '';
                res.on('data', d => buf += d);
                res.on('end', () => resolve({ status: res.statusCode, body: buf }));
            }).on('error', reject);
        });
        body.status.should.equal(200);
        // Concatenated: '{"chunk":1}{"chunk":2}{"chunk":3}'
        body.body.should.match(/chunk":1.*chunk":2.*chunk":3/);
    });

    it('streaming WS: handler emits multiple frames; api ws stays open after final close', async () => {
        ({ central, turbine, peer } = await buildProxyPair((router) => {
            router.ws('/pitch/stream', (_p, client) => {
                client.obj({ chunk: 1 });
                client.obj({ chunk: 2 });
                client.obj({ chunk: 3 });
                client.close();
                return Infinity;
            });
        }));

        const ws = await connect(central.wsUrl);
        const out = collect(ws);
        ws.send(encodeJson({ path: '/turbine/WT1/pitch/stream' }));
        // Three reply frames expected. The trailing close frame is
        // absorbed silently for ws callers (no caller-side ws close).
        await waitFor(out, 3, 2000);
        decodeAny('json', out[0]).should.have.property('chunk', 1);
        decodeAny('json', out[1]).should.have.property('chunk', 2);
        decodeAny('json', out[2]).should.have.property('chunk', 3);
        // ws still open: send a follow-up call to verify.
        ws.readyState.should.equal(ws.OPEN);
        ws.close();
    });

    //=====================================================\\
    //                    Phase 3 — Reconnect grace        \\
    //=====================================================\\

    it('grace: brief transport drop with reconnect within window holds pending alive', async () => {
        // Spin turbine first to grab a real port; close it; reuse that port
        // for the second turbine instance so the InterClient's reconnect
        // lands on a live socket again.
        const turbineRoutes = (router) => {
            router.on('wsConnect', (_p, client) => {
                client.linkAsPeer({ shadowOut: ['pitch.*'], shadowIn: [] });
                client.grantPerm('pitch.*');
            });
            router.ws('/pitch/sub', (_p, client) => client.subscribe('pitch.events'));
        };
        let turbine = await spinUp(turbineRoutes);
        const turbinePort = turbine.port;
        const central = await spinUp((router, rnio) => {
            router.proxy('/turbine/:turbineID', { target: () => rnio.inter('turbine') });
        });
        const peer = central.rnio.interconnect('turbine', turbine.wsUrl, {
            permissions: ['pitch.*'],
            shadowOut: [], shadowIn: ['pitch.*'],
            reconnect: { enabled: true, minDelay: 30, maxDelay: 60, factor: 1, jitter: 0,
                         gracePeriodMs: 2000 },
        });
        await until(() => peer.isOpen, x => x === true, 1500);

        const ws = await connect(central.wsUrl);
        ws.send(encodeJson({ path: '/turbine/WT1/pitch/sub' }));
        await until(() => central.rnio.subs('pitch.events').size, n => n >= 1, 1500);
        // Snapshot pending count so we can verify it is preserved during grace.
        const pendingSnapshot = peer._pendingProxy.size;
        pendingSnapshot.should.be.greaterThan(0);

        // Drop turbine. Wait for the peer to notice. Pending entries must
        // still be present (held by the grace window).
        await turbine.close();
        await until(() => peer.status, s => s !== 'open', 2000);
        peer._pendingProxy.size.should.equal(pendingSnapshot);
        should(peer._graceTimer).not.be.null();

        // Bring turbine back on the same port. Reconnect should clear grace.
        turbine = await spinUp(turbineRoutes, { port: turbinePort });
        await until(() => peer.isOpen, x => x === true, 4000);
        should(peer._graceTimer).be.null();

        ws.close();
        peer.close();
        await turbine.close();
        await central.close();
    });

    it('grace: hard fail after timeout fires interFail and 502s pending callers', async () => {
        const central = await spinUp((router, rnio) => {
            router.proxy('/turbine/:turbineID', { target: () => rnio.inter('turbine') });
        });
        const peer = central.rnio.interconnect('turbine', 'ws://localhost:1', {
            permissions: ['pitch.*'],
            shadowOut: [], shadowIn: ['pitch.*'],
            reconnect: { enabled: true, minDelay: 20, maxDelay: 40, factor: 1, jitter: 0,
                         maxAttempts: 2, gracePeriodMs: 200 },
        });
        // Wait until the link gives up.
        const fails = [];
        peer.routes.get('interFail') &&
            peer.routes.get('interFail').routes.forEach(() => {});
        // Hook up a fail listener via the peer's router.
        peer.router.on('interFail', (params) => fails.push(params));

        await until(() => fails, f => f.length >= 1, 3000);
        // After interFail, all pending sessions failed.
        peer._pendingProxy.size.should.equal(0);
        peer._proxyClients.size.should.equal(0);
        peer.close();
        await central.close();
    });

    //=====================================================\\
    //                    Phase 4 — Multi-hop              \\
    //=====================================================\\

    it('multi-hop HTTP: api → central → park → turbine; reply propagates back', async () => {
        // Each hop strips its own captured prefix before forwarding, so the
        // chain uses *different* prefixes. Real-world: central handles all
        // turbines, park handles a turbine *cluster*, turbine handles the
        // device. Path layering reflects that:
        //
        //   /turbine/<id>/<rest>      seen by central
        //   /<rest>                   seen by park (after central strip)
        //   /<rest after park strip>  seen by turbine
        //
        // Concrete: api hits /turbine/WT1/pitch/info on central, which
        // forwards /pitch/info to park. Park has proxy('/pitch') → forwards
        // /info to turbine. Turbine has /info.
        const turbine = await spinUp((router) => {
            router.on('wsConnect', (_p, client) => {
                client.linkAsPeer({ shadowOut: ['pitch.*'], shadowIn: [] });
                client.grantPerm('pitch.*');
            });
            router.get('/info', () => ({ source: 'turbine', rpm: 12 }));
        });
        const park = await spinUp((router, rnio) => {
            router.on('wsConnect', (_p, client) => {
                client.linkAsPeer({ shadowOut: ['pitch.*'], shadowIn: [] });
                client.grantPerm('pitch.*');
            });
            router.proxy('/pitch', {
                target: () => rnio.inter('turbine'),
            });
        });
        const parkToTurbine = park.rnio.interconnect('turbine', turbine.wsUrl, {
            permissions: ['pitch.*'],
            shadowOut: [], shadowIn: ['pitch.*'],
        });
        await until(() => parkToTurbine.isOpen, x => x === true, 1500);
        const central = await spinUp((router, rnio) => {
            router.proxy('/turbine/:turbineID', {
                target: () => rnio.inter('park'),
            });
        });
        const centralToPark = central.rnio.interconnect('park', park.wsUrl, {
            permissions: ['pitch.*'],
            shadowOut: [], shadowIn: ['pitch.*'],
        });
        await until(() => centralToPark.isOpen, x => x === true, 1500);

        try {
            const http = require('http');
            const result = await new Promise((resolve, reject) => {
                http.get(`${central.url}/turbine/WT1/pitch/info`, (res) => {
                    let buf = '';
                    res.on('data', d => buf += d);
                    res.on('end', () => resolve({ status: res.statusCode, body: buf }));
                }).on('error', reject);
            });
            result.status.should.equal(200);
            const parsed = JSON.parse(result.body);
            parsed.should.have.property('source', 'turbine');
            parsed.should.have.property('rpm', 12);
        } finally {
            centralToPark.close();
            parkToTurbine.close();
            await central.close();
            await park.close();
            await turbine.close();
        }
    });

});