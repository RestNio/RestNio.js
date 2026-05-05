/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const { randomUUID } = require('crypto');

/**
 * Typedef Imports
 * @typedef {import("../client/Client")} Client
 */

/**
 * @typedef PeerLinkOptions
 * @property {(string[]|RegExp[])} [shadowOut] - patterns of local sub channel
 * names whose `subs(channel).<broadcast>(...)` calls are forwarded to this
 * peer as a single coalesced shadow frame `{_proxyrchan:{channel, kind, args}}`.
 * Patterns are either glob strings (`'WT1.*'`) or `RegExp`s. Default empty
 * (no shadow forwarding allowed in this direction).
 * @property {(string[]|RegExp[])} [shadowIn] - patterns of channel names this
 * peer is allowed to push shadow frames to us under. Incoming frames with a
 * channel not matching any pattern are dropped + logged. Default empty.
 */

/**
 * Shared behavior for every connection that acts as a *peer link* — an
 * outbound {@link InterClient} or an inbound {@link WebSocketClient} that has
 * been promoted to a peer (via `linkAsPeer`). Encapsulates:
 *
 *   - Shadow channel whitelists (`shadowIn` / `shadowOut`).
 *   - The {@link ProxyClient} table for clients minted on this side.
 *   - The pending-call table for clients that originated *here* and are
 *     waiting for a `_proxyr` reply.
 *   - Per-publish shadow coalescing buffer + microtask flush.
 *
 * Implemented as a helper module rather than a class so both
 * {@link InterClient} (which extends Client) and {@link WebSocketClient}
 * (which also extends Client) can share the logic without multiple
 * inheritance.
 */
const peerLink = {

    /**
     * Initialise per-peer state. Idempotent — calling twice replaces config.
     * @param {Client} client - the underlying transport client.
     * @param {PeerLinkOptions} [opts]
     */
    init(client, opts = {}) {
        client._isPeerLink = true;
        client._shadowOut = compilePatterns(opts.shadowOut);
        client._shadowIn  = compilePatterns(opts.shadowIn);

        // ProxyClients minted on THIS side, keyed by id.
        if (!client._proxyClients) client._proxyClients = new Map();

        // Pending request table — when this side acts as a *caller* (sent
        // `_proxyenv`, awaiting `_proxyr`), each entry maps the proxy id to
        // the original local Client that should receive the reply.
        if (!client._pendingProxy) client._pendingProxy = new Map();

        // Shadow-publish coalescing buffer. Keyed by `${channel}|${publishId}`.
        if (!client._shadowQueue) client._shadowQueue = new Map();
        client._shadowFlushScheduled = false;
    },

    /**
     * @param {Client} client
     * @param {string} channel
     * @returns {boolean}
     */
    shadowOutAllows(client, channel) {
        return matchAny(client._shadowOut, channel);
    },

    /**
     * @param {Client} client
     * @param {string} channel
     * @returns {boolean}
     */
    shadowInAllows(client, channel) {
        return matchAny(client._shadowIn, channel);
    },

    /**
     * Queue a shadow fan-out for a given (channel, publishId, kind, args).
     * If another caller in the same publish round already queued the same
     * (channel, publishId), this is a no-op — the receiver will see exactly
     * one shadow frame even when N ProxyClients on this peer are subscribed.
     *
     * `kind` echoes the {@link Client} method that triggered the publish
     * (`'obj'` | `'str'` | `'bin'` | `'buf'` | `'err'` | `'json'` | `'close'`
     * | `'ok'`). `args` is the argument tuple to replay on the receiver.
     *
     * @param {Client} client
     * @param {string} channel
     * @param {number} publishId
     * @param {string} kind
     * @param {Array} args
     */
    queueShadow(client, channel, publishId, kind, args) {
        const key = `${channel}|${publishId}`;
        if (client._shadowQueue.has(key)) return;
        client._shadowQueue.set(key, { channel, kind, args });
        if (!client._shadowFlushScheduled) {
            client._shadowFlushScheduled = true;
            queueMicrotask(() => peerLink.flushShadow(client));
        }
    },

    /**
     * Drain the shadow buffer, sending one wire frame per (channel, publishId).
     * @param {Client} client
     */
    flushShadow(client) {
        client._shadowFlushScheduled = false;
        if (!client._shadowQueue.size) return;
        const queue = client._shadowQueue;
        client._shadowQueue = new Map();
        for (const { channel, kind, args } of queue.values()) {
            client.obj({ _proxyrchan: { channel, kind, args } });
        }
    },

    /**
     * Send a tagged direct reply (used when a ProxyClient member of a
     * non-whitelisted channel publishes — falls back to per-client delivery
     * — and for `client.obj()` style direct calls outside a publish round).
     * `kind` lets the receiving side reconstruct which {@link Client}
     * method to invoke on the original caller.
     *
     * @param {Client} client
     * @param {string} id
     * @param {string} kind
     * @param {Array} args
     * @param {{last?: boolean}} [opts]
     */
    sendProxyR(client, id, kind, args, opts = {}) {
        const frame = { _proxyr: { id, kind, args } };
        if (opts.last) frame._proxyr.last = true;
        client.obj(frame);
    },

    /**
     * Send the back-prop sub event so the calling side can mirror the sub on
     * the original caller's local sub list.
     * @param {Client} client
     * @param {string} id
     * @param {string} channel
     * @param {'add'|'remove'} op
     */
    sendProxyRSub(client, id, channel, op) {
        client.obj({ _proxyrsub: { id, channel, op } });
    },

    /**
     * Mint a fresh proxy id. Caller side picks the id; callee echoes it on
     * every reply / sub event / close frame.
     * @returns {string}
     */
    mintId() {
        return randomUUID();
    },

    /**
     * Install a pending entry — call this before sending `_proxyenv` so the
     * `_proxyr` reply can be routed back to the originating client. Returns
     * the id (mint if not provided).
     * @param {Client} client - peer-link client
     * @param {Client} caller - the local client that will receive the reply
     * @param {{id?: string, timeoutMs?: number, onTimeout?: Function}} [opts]
     * @returns {string}
     */
    addPending(client, caller, opts = {}) {
        const id = opts.id || peerLink.mintId();
        const timeoutMs = (opts.timeoutMs == null) ? 30000 : opts.timeoutMs;
        const entry = { caller, expiresAt: 0, timer: null };
        if (timeoutMs > 0) {
            entry.expiresAt = Date.now() + timeoutMs;
            entry.timer = setTimeout(() => {
                if (client._pendingProxy.get(id) === entry) {
                    client._pendingProxy.delete(id);
                    if (typeof opts.onTimeout === 'function') opts.onTimeout(caller);
                    else if (caller && typeof caller.err === 'function') {
                        caller.err('proxy timeout', 504);
                    }
                }
            }, timeoutMs);
        }
        client._pendingProxy.set(id, entry);
        return id;
    },

    /**
     * Look up + remove a pending entry. Returns `null` if no entry was present.
     * @param {Client} client
     * @param {string} id
     * @returns {{caller: Client}|null}
     */
    consumePending(client, id) {
        const entry = client._pendingProxy.get(id);
        if (!entry) return null;
        if (entry.timer) clearTimeout(entry.timer);
        client._pendingProxy.delete(id);
        return entry;
    },

    /**
     * Peek a pending entry without removing it. Used by streaming replies
     * where multiple `_proxyr` frames arrive before `last: true`.
     * @param {Client} client
     * @param {string} id
     * @returns {{caller: Client}|null}
     */
    peekPending(client, id) {
        return client._pendingProxy.get(id) || null;
    },

    /**
     * Drop every pending entry on this peer (call on connection close).
     * Each caller is informed via `caller.err('proxy peer disconnected', 502)`.
     * @param {Client} client
     */
    failAllPending(client) {
        if (!client._pendingProxy || !client._pendingProxy.size) return;
        for (const [, entry] of client._pendingProxy) {
            if (entry.timer) clearTimeout(entry.timer);
            if (entry.caller && typeof entry.caller.err === 'function') {
                entry.caller.err('proxy peer disconnected', 502);
            }
        }
        client._pendingProxy.clear();
    },

    /**
     * Tear down all ProxyClients minted on this side — e.g. when the peer
     * link itself dies. Each ProxyClient runs its standard close path
     * (unsubAll + wsClose hooks).
     * @param {Client} client
     */
    closeAllProxyClients(client) {
        if (!client._proxyClients || !client._proxyClients.size) return;
        const all = [...client._proxyClients.values()];
        client._proxyClients.clear();
        for (const pc of all) pc.close();
    },

};

/**
 * Compile a list of glob strings or RegExps into a flat RegExp[] for fast
 * matching. Globs support `*` (any chars within a segment) and `**` (any
 * chars including dots). Empty / null input yields `[]`.
 * @param {(string[]|RegExp[]|undefined)} patterns
 * @returns {RegExp[]}
 */
function compilePatterns(patterns) {
    if (!patterns || !patterns.length) return [];
    return patterns.map(p => {
        if (p instanceof RegExp) return p;
        if (typeof p !== 'string') return null;
        // Glob → regex. `**` first (greedy any), `*` second (anything but '.').
        const escaped = p
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '.+')
            .replace(/\*/g, '[^.]+');
        return new RegExp('^' + escaped + '$');
    }).filter(Boolean);
}

/**
 * @param {RegExp[]} patterns
 * @param {string} value
 * @returns {boolean}
 */
function matchAny(patterns, value) {
    if (!patterns || !patterns.length) return false;
    for (const re of patterns) if (re.test(value)) return true;
    return false;
}

module.exports = peerLink;
module.exports.compilePatterns = compilePatterns;
module.exports.matchAny = matchAny;