/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

/**
 * Typedef Imports
 * @typedef {import("../client/Client")} Client
 * @typedef {import("../RestNio")} RestNio
 */

/**
 * @typedef SubBridgeOptions
 * @property {(string[]|'*'|null)} [out] - local sub channels whose frames flow
 * OUT to the peer link. `'*'` mirrors every channel currently in the
 * SubscriptionMap and any created later (greedy — see warning below).
 * @property {(string[]|'*'|null)} [in] - sub frames received FROM the peer that
 * we re-publish locally. `'*'` accepts any channel name. Channel names on the
 * wire ARE the names re-published locally; this side does not remap.
 * @property {string} [prefix] - applied to OUT channel names: local channel
 * `telem` is sent over the wire as `<prefix>.telem`. Receiver re-publishes
 * under that prefixed name. Use to namespace per-source in a tree topology.
 * @property {boolean} [onDemand] - reserved for future ref-count-driven
 * subscribe/unsubscribe control. Currently a no-op (frames flow always for
 * configured channels).
 *
 * Wildcard warning: `out: '*'` forwards EVERY local sub channel including
 * internal/non-application ones. Only use in trusted topologies where you own
 * channel naming hygiene. Prefer explicit lists for safety.
 *
 * Echo prevention (v1 rule): a channel must be `out`-only or `in`-only on a
 * given bridge. Listing the same name in both throws; if you need a duplex
 * channel, use distinct names for the two directions.
 */

/**
 * @exports SubBridge
 * @class SubBridge
 * @author 7kasper
 * @classdesc
 * Bridges subscription pub/sub across a peer link. Attached to a single
 * peer-link {@link Client} (an outbound {@link InterClient} OR the inbound
 * {@link WebSocketClient} that mirrors a peer on the other end). Both sides of
 * the link configure their own bridge — direction is local-to-local, frames
 * cross the wire wrapped in `_type: 'sub.frame'` envelopes.
 *
 * Out flow (local emit → peer):
 *   1. Bridge subscribes a virtual subscriber to each local OUT channel.
 *   2. When `rnio.subs(channel).obj(payload)` is called locally, the virtual
 *      subscriber's `.obj()` wraps the payload as
 *      `{_type: 'sub.frame', channel: <prefixed>, payload}` and pushes it via
 *      the peer-link client.
 *
 * In flow (peer emit → local):
 *   1. Peer-link's envelope dispatcher detects `_type: 'sub.frame'` and
 *      routes it to this bridge.
 *   2. Bridge re-publishes the payload locally as
 *      `rnio.subs(channel).obj(payload)`.
 *
 * Local emitters and local subscribers stay agnostic — they don't see the
 * bridge at all. Adding/removing a bridged peer is transparent.
 */
class SubBridge {

    /**
     * Construct via {@link Client#subBridge}, not directly.
     * @param {Client} client - the peer-link client this bridge is bound to.
     * @param {SubBridgeOptions} opts
     */
    constructor(client, opts = {}) {
        this.client = client;
        /** @type {RestNio} */
        this.rnio = client.restnio;
        this.prefix = opts.prefix || null;
        this.onDemand = !!opts.onDemand; // reserved; v1 ignores

        const outSpec = opts.out;
        const inSpec  = opts.in;
        this.outAll  = outSpec === '*';
        this.inAll   = inSpec === '*';
        this.outList = Array.isArray(outSpec) ? new Set(outSpec) : new Set();
        this.inList  = Array.isArray(inSpec)  ? new Set(inSpec)  : new Set();

        // Echo guard — same channel up AND down on the same bridge would
        // bounce frames in a tight loop.
        for (const ch of this.outList) {
            if (this.inList.has(ch)) {
                throw `SubBridge: channel '${ch}' configured for both out and in — pick distinct names per direction.`;
            }
        }

        /** @type {Map<string, Object>} local channel name → virtual subscriber */
        this._outProxies = new Map();

        // Wire OUT side. Wildcard hooks the SubscriptionMap so newly-created
        // channels also bridge automatically.
        if (this.outAll) {
            this._channelListener = (action, name) => {
                if (action === 'add') this._wireOut(name);
            };
            this.rnio.subscriptions.onChannelCreate(this._channelListener);
        } else {
            for (const name of this.outList) this._wireOut(name);
        }
    }

    /**
     * Inbound side — invoked by {@link InterClient}/{@link WebSocketClient}
     * when an envelope of type `sub.frame` arrives matching this bridge.
     * Re-publishes the payload on the local `channel`.
     *
     * Drops malformed frames silently (non-string `channel` or `undefined`
     * payload) instead of forwarding them. Without these guards a buggy or
     * malicious peer could publish `undefined` to local subs and crash any
     * downstream code that assumes a payload object, or pollute the
     * `SubscriptionMap` keyspace by passing a non-string channel.
     *
     * @param {string} channel
     * @param {*} payload
     */
    handleInFrame(channel, payload) {
        if (typeof channel !== 'string' || channel.length === 0) return;
        if (typeof payload === 'undefined') return;
        if (!this.acceptsIn(channel)) return;
        this.rnio.subs(channel).obj(payload);
    }

    /**
     * Whether this bridge accepts inbound frames on `channel`.
     * @param {string} channel
     * @returns {boolean}
     */
    acceptsIn(channel) {
        return this.inAll || this.inList.has(channel);
    }

    /**
     * Tear down: unsubscribe all virtual proxies and detach wildcard listener.
     */
    teardown() {
        if (this._channelListener) {
            this.rnio.subscriptions.offChannelCreate(this._channelListener);
            this._channelListener = null;
        }
        for (const [name, proxy] of this._outProxies) {
            this.rnio.subscriptions.unsubscribe(name, proxy);
        }
        this._outProxies.clear();
    }

    //=====================================================\\
    //			           Internal	          	   	       \\
    //=====================================================\\

    /**
     * Subscribe a virtual proxy to local channel `name` so emitted frames
     * flow over the peer link.
     *
     * Communication methods supported on the proxy (mirroring `ClientSet`):
     *  - `obj`, `str`, `json` — forwarded as `sub.frame` envelopes with the
     *    value as `payload`. Receiver re-publishes via `subs(channel).obj(payload)`.
     *  - `bin` / `buf` — NOT supported. The `sub.frame` envelope is
     *    JSON-encoded on the wire, so a binary payload would be lossy. A warn
     *    is logged once per bridge so missed binary fan-outs are visible.
     *    Wire your own binary-frame transport if needed (see the wiki).
     *  - `err`, `ok`, `close` — no-op. Connection-level semantics that don't
     *    map to channel-data fan-out.
     *
     * @param {string} name - local sub channel name.
     */
    _wireOut(name) {
        if (this._outProxies.has(name)) return;
        const remoteName = this.prefix ? `${this.prefix}.${name}` : name;
        const peer = this.client;
        const wrap = (payload) => ({
            _type:   'sub.frame',
            channel: remoteName,
            payload,
        });
        const send = (payload) => {
            if (typeof peer.obj === 'function') peer.obj(wrap(payload));
        };
        // Logged once per channel — silent flooding of warnings is worse
        // than a single visible drop notice.
        let binWarned = false;
        const proxy = {
            _subBridgeProxy: true,
            obj(payload) { send(payload); },
            str(s)       { send(s); },
            json(...args) {
                // Mirror ClientSet.json — forwards the args. Single-arg case
                // sends the value verbatim; multi-arg is rare but kept for
                // parity (encoded as the array).
                send(args.length === 1 ? args[0] : args);
            },
            bin() {
                if (!binWarned) {
                    binWarned = true;
                    console.warn(
                        `[restnio/SubBridge] subs('${name}').bin/.buf is not bridged ` +
                        `(channel '${remoteName}'). sub.frame is JSON-encoded; wire your own ` +
                        `binary transport for binary pub/sub.`
                    );
                }
            },
            buf() { this.bin(); },
            err()   {},
            ok()    {},
            close() {},
        };
        this._outProxies.set(name, proxy);
        this.rnio.subscriptions.subscribe(name, proxy);
    }
}

module.exports = SubBridge;
