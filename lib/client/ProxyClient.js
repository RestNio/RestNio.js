/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const _ = require('lodash');
const Client = require('./Client');
const PermissionSet = require('../util/PermissionSet');
const peerLink = require('../util/peerLink');
const codecs = require('../codec');

/**
 * Typedef Imports
 * @typedef {import("../RestNio")} RestNio
 * @typedef {import("./Client")} ClientType
 */

/**
 * @typedef ProxyOpenInfo
 * @property {string} id - opaque, caller-side-minted id used to correlate
 *   every frame for this proxied client.
 * @property {Object} [actor] - the original caller's actor claim
 *   `{sub, perms[], ...passthrough}`. Populates `client.token` and
 *   `client.actor` for handler convenience.
 * @property {string[]} [perms] - claimed permissions; clamped against the
 *   peer link's connection cap. Defaults to `actor.perms` when absent.
 * @property {('persistent'|'request')} [mode] - lifecycle mode. `'request'`
 *   = auto-close after the first handler returns (HTTP / one-shot).
 *   `'persistent'` (default) = stays alive until explicit `_proxyclose`,
 *   peer-link drop, or callee-side `client.close()`.
 */

/**
 * @class ProxyClient
 * @extends Client
 * @author 7kasper
 * @classdesc
 * Persistent in-process representation of a remote caller that reached this
 * server through a peer link (typically: api client → central → turbine,
 * where this ProxyClient lives on the turbine side and stands in for the api
 * client). From the perspective of route handlers it is indistinguishable
 * from a {@link WebSocketClient} — `client.obj(...)`, `client.subscribe(...)`,
 * `client.state.x = y`, returning a value, even deferred
 * `setTimeout(() => client.obj(...))` all work transparently. Every outbound
 * frame is tunneled through the underlying peer link as a `_proxyr` envelope
 * (or a coalesced `_proxyrchan` shadow on a publish round) and unpacked at
 * the calling end so the original caller sees the response as if it had
 * spoken to this server directly.
 *
 * **Identity is per (caller, peer-link) pair.** The same api client making
 * five proxied requests through the same central reuses the same ProxyClient
 * and id (assigned by the calling side). Subscriptions, state, and pending
 * deferred work persist across those requests as on a normal WS client.
 *
 * **Lifetime.** Created on the first `_proxyenv` carrying an `open` block,
 * lives until the calling side sends `_proxyclose`, until the peer link
 * itself drops, until the callee-side handler calls `client.close()`, or —
 * in `mode: 'request'` — until the first handler return. On close the
 * standard `wsClose` lifecycle fires and all subscriptions are dropped.
 *
 * **Permissions.** Computed once at construction as the intersection of the
 * peer link's connection cap and the caller's claimed permissions. Per-route
 * checks read `client.permissions` like any other client.
 *
 * **Coalescing.** When ClientSet broadcast methods invoke
 * `client.obj(payload, channel, publishId)` (or any of the other broadcast
 * methods with a trailing `(channel, publishId)` tuple), this class routes
 * through the peer link's shadow buffer. Multiple ProxyClients on the same
 * peer subscribed to the same channel collapse to ONE wire frame
 * `{_proxyrchan: {channel, kind, args}}` per publish. Manual one-arg calls
 * (`client.obj(x)`) outside of a publish round fall back to a tagged
 * `_proxyr` frame.
 *
 * Construct via incoming `_proxyenv` dispatch on a peer link, not directly.
 */
class ProxyClient extends Client {

    /**
     * @param {RestNio} restnio
     * @param {ClientType} peer - the underlying peer-link client.
     * @param {ProxyOpenInfo} info
     */
    constructor(restnio, peer, info) {
        // Synthesize a minimal request so base Client and any property
        // defaults that touch headers/socket can read fields without
        // crashing. Carry through the underlying peer's request when
        // present so logs and IP extraction behave reasonably.
        const fakeReq = (peer && peer.request) || { headers: {}, socket: { remoteAddress: null } };
        super('proxy', restnio, fakeReq,
            _.defaultsDeep({}, restnio.options.default.wsProperties),
            []);

        this.id   = info.id;
        this.peer = peer;
        this.mode = info.mode === 'request' ? 'request' : 'persistent';

        // Inbound permission claim, clamped against the peer link's cap.
        const claimed = new PermissionSet(
            Array.isArray(info.perms) ? info.perms
            : (info.actor && Array.isArray(info.actor.perms)) ? info.actor.perms
            : []
        );
        const peerCap = (peer && peer.permissions) || new PermissionSet([]);
        this.permissions = peerCap.intersect(claimed);

        // Make `client.actor` directly readable. We deliberately do NOT use
        // the AsyncLocalStorage envelope context for ProxyClients — actor
        // is bound to the client object identity, which survives awaits and
        // arbitrary deferred calls without context propagation.
        Object.defineProperty(this, 'actor', {
            value: info.actor || null,
            writable: false,
            configurable: false,
        });

        if (info.actor) {
            this.token = {
                sub: info.actor.sub,
                permissions: Array.isArray(info.actor.perms) ? info.actor.perms : [],
            };
        }

        this.codec = (peer && peer.codec) || codecs.json;

        /** Marker the {@link ClientSet} reads to skip the trailing-args path. */
        this._isProxyClient = true;

        /** Mirrors {@link WebSocketClient#isAlive}; the wsClose lifecycle runs at most once. */
        this.isAlive = true;
    }

    //=====================================================\\
    //                      Communications                  \\
    //=====================================================\\
    //
    // Each broadcast method below has the same shape:
    //
    //   1) If the trailing `(channel, pid)` tuple is present we are inside a
    //      `subs(channel).<method>(...)` publish round. Coalesce via the
    //      peer link's shadow buffer keyed by `(channel, pid)` so N
    //      ProxyClients on this peer collapse to one wire frame.
    //   2) Otherwise this is a manual / direct call (`client.obj(payload)`,
    //      handler return value, etc.). Send a tagged `_proxyr` frame so
    //      the calling side delivers it specifically to this caller.
    //
    // The `kind` string echoes the method name so the receiver can rebuild
    // the original call: `caller[kind](...args)` for tagged delivery,
    // `subs(channel)[kind](...args)` for shadow broadcast.

    /**
     * Send an object back. In a publish round (`channel`/`pid` present),
     * coalesces via the peer's shadow buffer; otherwise tagged direct.
     * @param {*} payload
     * @param {string} [channel]
     * @param {number} [pid]
     */
    obj(payload, channel, pid) {
        if (!this.isAlive) return;
        if (channel != null && pid != null) {
            this._coalesce(channel, pid, 'obj', [payload]);
        } else {
            peerLink.sendProxyR(this.peer, this.id, 'obj', [payload]);
        }
    }

    /**
     * Send a string. See {@link ProxyClient#obj}.
     * @param {string} str
     * @param {string} [channel]
     * @param {number} [pid]
     */
    str(str, channel, pid) {
        if (!this.isAlive) return;
        if (channel != null && pid != null) {
            this._coalesce(channel, pid, 'str', [str]);
        } else {
            peerLink.sendProxyR(this.peer, this.id, 'str', [str]);
        }
    }

    /**
     * Send raw bytes. See {@link ProxyClient#obj}.
     * @param {Buffer} buf
     * @param {string} [channel]
     * @param {number} [pid]
     */
    bin(buf, channel, pid) {
        if (!this.isAlive) return;
        if (channel != null && pid != null) {
            this._coalesce(channel, pid, 'bin', [buf]);
        } else {
            peerLink.sendProxyR(this.peer, this.id, 'bin', [buf]);
        }
    }

    /**
     * Alias for {@link ProxyClient#bin}, mirrors {@link Client#buf}.
     */
    buf(buf, channel, pid) {
        if (!this.isAlive) return;
        if (channel != null && pid != null) {
            this._coalesce(channel, pid, 'buf', [buf]);
        } else {
            peerLink.sendProxyR(this.peer, this.id, 'buf', [buf]);
        }
    }

    /**
     * JSON-encoded broadcast. Args after the payload — JSON.stringify-style
     * — are followed by the optional `(channel, pid)` tuple so we can
     * scrape it off the tail.
     */
    json(...all) {
        if (!this.isAlive) return;
        const { args, channel, pid } = stripPubTail(all);
        if (channel != null && pid != null) {
            this._coalesce(channel, pid, 'json', args);
        } else {
            peerLink.sendProxyR(this.peer, this.id, 'json', args);
        }
    }

    /**
     * Send an error + statuscode. See {@link ProxyClient#obj}.
     * @param {*} err
     * @param {number} [code]
     * @param {string} [channel]
     * @param {number} [pid]
     */
    err(err, code = 500, channel, pid) {
        if (!this.isAlive) return;
        const errStr = err && err.toString ? err.toString() : String(err);
        if (channel != null && pid != null) {
            this._coalesce(channel, pid, 'err', [errStr, code]);
        } else {
            peerLink.sendProxyR(this.peer, this.id, 'err', [errStr, code]);
        }
    }

    /**
     * `ok` over a peer link is a no-payload "route ran" signal. We forward
     * it for parity with {@link ClientSet}; receivers replay
     * `subs(channel).ok()` or `caller.ok()` accordingly.
     * @param {string} [channel]
     * @param {number} [pid]
     */
    ok(channel, pid) {
        if (!this.isAlive) return;
        if (channel != null && pid != null) {
            this._coalesce(channel, pid, 'ok', []);
        } else {
            peerLink.sendProxyR(this.peer, this.id, 'ok', []);
        }
    }

    /**
     * `client.subscribe('channel')` enters this ProxyClient into the local
     * sub list AND back-propagates so the calling side mirrors the sub on
     * the original caller. Without the back-prop, the calling side wouldn't
     * know to deliver shadow frames for that channel back down to the
     * original caller.
     * @param {string} name
     */
    subscribe(name) {
        super.subscribe(name);
        peerLink.sendProxyRSub(this.peer, this.id, name, 'add');
    }

    /**
     * Symmetric to {@link ProxyClient#subscribe}.
     * @param {string} name
     */
    unsubscribe(name) {
        super.unsubscribe(name);
        peerLink.sendProxyRSub(this.peer, this.id, name, 'remove');
    }

    //=====================================================\\
    //                       Lifecycle                      \\
    //=====================================================\\

    /**
     * Run any `wsClose` lifecycle handlers on this client. Mirrors
     * {@link WebSocketClient#callWSClose} so user code that registered
     * `router.on('wsClose', ...)` sees ProxyClient closes uniformly.
     * Idempotent.
     * @param {*} [reason]
     */
    async callWSClose(reason) {
        if (!this.isAlive) return;
        this.isAlive = false;
        const closeRoutes = this.restnio.routes.get('wsClose');
        if (closeRoutes && closeRoutes.routes) {
            for (const closer of closeRoutes.routes) {
                try { await this.executeRoute(closer, { reason }); }
                catch (err) { if (this.props.logErrors) console.error(err); }
            }
        }
    }

    /**
     * Closes the proxy client. Fires `wsClose` handlers, drops subs, removes
     * from the peer's proxy table, and (unless suppressed) emits a terminal
     * `_proxyr {kind: 'close', last: true}` so the calling side can end its
     * response or GC its pending entry.
     *
     * Trailing `(reason, channel, pid)` accommodates the channel-aware
     * `subs(channel).close()` path used by {@link ClientSet}: when invoked
     * inside a publish round we coalesce a shadow `close` so the calling
     * side runs `subs(channel).close()` on its local sub list.
     *
     * Pass `_fromRemote: true` (or `reason._fromRemote`) when the close was
     * triggered by an inbound `_proxyclose` from the calling side — in that
     * case we skip the terminal frame to avoid looping.
     *
     * @param {*} [reason]
     * @param {string} [channel]
     * @param {number} [pid]
     */
    close(reason, channel, pid) {
        if (channel != null && pid != null) {
            // subs(channel).close() reached us. Coalesce to one shadow frame;
            // the calling side runs subs(channel).close() on its locals.
            this._coalesce(channel, pid, 'close', [reason]);
            return;
        }
        const wasAlive = this.isAlive;
        // Tell the calling side to wrap up — write end-of-stream for HTTP,
        // GC the pending session for WS — UNLESS the close itself was
        // triggered by the calling side (`_fromRemote`), in which case the
        // caller already knows.
        const fromRemote = !!(reason && reason._fromRemote);
        if (wasAlive && !fromRemote) {
            peerLink.sendProxyR(this.peer, this.id, 'close', [], { last: true });
        }
        if (wasAlive) {
            this.callWSClose(reason).catch(err => {
                if (this.props.logErrors) console.error(err);
            });
        }
        super.close();
        if (this.peer && this.peer._proxyClients) {
            this.peer._proxyClients.delete(this.id);
        }
    }

    //=====================================================\\
    //                       Internal                       \\
    //=====================================================\\

    /**
     * Common path for all coalesced (channel-aware) broadcasts. Routes
     * through the peer link's shadow buffer when whitelisted, otherwise
     * falls back to a tagged direct `_proxyr` frame so the caller still
     * receives the message — at the cost of N frames for N ProxyClients.
     * @private
     */
    _coalesce(channel, publishId, kind, args) {
        if (peerLink.shadowOutAllows(this.peer, channel)) {
            peerLink.queueShadow(this.peer, channel, publishId, kind, args);
        } else {
            peerLink.sendProxyR(this.peer, this.id, kind, args);
        }
    }

}

/**
 * `client.json(...args, channel, pid)` — when ClientSet calls it, the last
 * two args are the publish tuple. Detect by inspecting the trailing two
 * positions: if they look like `(string, number)` we treat them as the
 * tuple and slice them off. Standalone `client.json(a, b)` calls with
 * `(string, number)` tail collide with this heuristic — acceptable cost,
 * since proxied JSON is a rare path.
 * @param {Array} all
 * @returns {{args: Array, channel?: string, pid?: number}}
 */
function stripPubTail(all) {
    if (all.length >= 2 &&
        typeof all[all.length - 2] === 'string' &&
        typeof all[all.length - 1] === 'number')
    {
        return {
            args:    all.slice(0, -2),
            channel: all[all.length - 2],
            pid:     all[all.length - 1],
        };
    }
    return { args: all };
}

module.exports = ProxyClient;