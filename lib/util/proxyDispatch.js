/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const peerLink = require('./peerLink');
const Parser = require('../routing/Parser');

/**
 * Typedef Imports
 * @typedef {import("../client/Client")} Client
 * @typedef {import("../client/ProxyClient")} ProxyClient
 */

// Lazy-required to break the import cycle: ProxyClient → peerLink → us → ProxyClient.
let ProxyClient = null;
function getProxyClient() {
    if (!ProxyClient) ProxyClient = require('../client/ProxyClient');
    return ProxyClient;
}

/**
 * Dispatcher for proxy-protocol frames received over a peer-link. Both
 * {@link InterClient} and a peer-promoted {@link WebSocketClient} call into
 * `handle(peer, request)` from their `routeEnvelope` *before* path-based
 * routing — proxy frames carry their own lifecycle and must not fall through
 * to the user route map.
 *
 * Wire shapes:
 *
 *   Caller → callee:
 *     `{ _proxyenv:   { id, env: {path, params, ...}, open?: {actor, perms, mode?} } }`
 *     `{ _proxyclose: { id, reason? } }`
 *
 *   Callee → caller:
 *     `{ _proxyr:     { id, kind, args, last? } }`
 *     `{ _proxyrchan: { channel, kind, args } }`
 *     `{ _proxyrsub:  { id, channel, op: 'add'|'remove' } }`
 *
 * Trust:
 *   - `_proxyrchan` is gated by `peer._shadowIn` whitelist.
 *   - `_proxyenv.open.perms` is clamped against the peer-link's connection
 *     cap inside the {@link ProxyClient} constructor.
 */
const proxyDispatch = {

    /**
     * @param {Client} peer - the peer-link client (InterClient or
     *   peer-promoted WebSocketClient).
     * @param {Object} request - decoded envelope.
     * @returns {Promise<boolean>} true if the request was a proxy frame
     *   and consumed; false otherwise (caller should continue normal
     *   dispatch).
     */
    async handle(peer, request) {
        if (!request || typeof request !== 'object') return false;

        if (request._proxyenv) return await proxyDispatch._handleEnv(peer, request._proxyenv);
        if (request._proxyclose) return proxyDispatch._handleClose(peer, request._proxyclose);
        if (request._proxyr) return proxyDispatch._handleR(peer, request._proxyr);
        if (request._proxyrchan) return proxyDispatch._handleRChan(peer, request._proxyrchan);
        if (request._proxyrsub) return proxyDispatch._handleRSub(peer, request._proxyrsub);

        return false;
    },

    //=====================================================\\
    //                       Inbound — callee side          \\
    //=====================================================\\

    /**
     * Handle `_proxyenv`: dispatch an envelope on a {@link ProxyClient}.
     * If `open` is present and no ProxyClient exists for the id, mint one.
     * If neither holds, reply with an error so the calling side doesn't
     * silently lose the request.
     * @private
     */
    async _handleEnv(peer, env) {
        if (!env || typeof env.id !== 'string') return true;

        let pc = peer._proxyClients.get(env.id);
        if (!pc) {
            if (!env.open) {
                // Caller assumed an existing session that doesn't exist.
                // Reply with an error so the caller's pending entry resolves
                // and they don't hang.
                peerLink.sendProxyR(peer, env.id, 'err',
                    ['proxy session not open', 410], { last: true });
                return true;
            }
            const PC = getProxyClient();
            pc = new PC(peer.restnio, peer, {
                id:    env.id,
                actor: env.open.actor,
                perms: env.open.perms,
                mode:  env.open.mode,
            });
            peer._proxyClients.set(env.id, pc);
        }

        const innerEnv = env.env;
        if (!innerEnv || typeof innerEnv !== 'object') {
            // `open`-only frame (no envelope) — just keep the ProxyClient
            // alive. Useful for explicit prelude before first request.
            return true;
        }

        await proxyDispatch._dispatchEnvelope(pc, innerEnv);

        // `mode: 'request'` = single-shot: tear down after the handler
        // resolves. EXCEPT when the handler hooked up a downstream proxy
        // session (multi-hop) — in that case the lifecycle is owned by
        // the downstream reply chain. The handler bumps
        // `client._proxyOutstanding` for every downstream session it
        // opens; we close only when the count is zero.
        const hasDownstream =
            (pc._proxyIds && pc._proxyIds.size > 0) ||
            (pc._proxyOutstanding > 0);
        if (pc.mode === 'request' && pc.isAlive && !hasDownstream) {
            pc.close();
        }
        return true;
    },

    /**
     * Run an envelope on a ProxyClient. Modeled on
     * {@link WebSocketClient#routeEnvelope} minus the trust gates that don't
     * apply (the ProxyClient already has its perms baked in at construction).
     * @private
     */
    async _dispatchEnvelope(pc, request) {
        // Wrap a non-object payload defensively so route handlers see a
        // params bag — same convention as WebSocketClient.routeEnvelope.
        if (typeof request !== 'object' || request === null) {
            request = { params: { body: request } };
        }
        if (!request.path) return;
        const routename = 'WS:' + request.path;
        await pc.run(routename, pc.restnio.routes, Parser.parseFullWsParams, request);
    },

    /**
     * Handle `_proxyclose`: tear down a ProxyClient by id. Idempotent.
     * The reason carries `_fromRemote: true` so {@link ProxyClient#close}
     * suppresses the back-frame that would otherwise loop the close to the
     * calling side that just sent us `_proxyclose`.
     * @private
     */
    _handleClose(peer, info) {
        if (!info || typeof info.id !== 'string') return true;
        const pc = peer._proxyClients.get(info.id);
        if (pc) {
            const reason = (info.reason && typeof info.reason === 'object')
                ? Object.assign({}, info.reason, { _fromRemote: true })
                : { reason: info.reason, _fromRemote: true };
            pc.close(reason);
        }
        return true;
    },

    //=====================================================\\
    //                       Inbound — caller side         \\
    //=====================================================\\

    /**
     * Handle `_proxyr`: tagged direct reply from the callee. Look up the
     * pending caller for this id, then invoke `caller[kind](...args)`. With
     * `last: true` the entry is consumed; without, it is peeked so streaming
     * replies can flow through.
     *
     * `kind === 'close'` is special: the callee has signaled end-of-session
     * for this proxy id. We do NOT replay it as `caller.close()` for ws
     * callers (that would close the api client's underlying socket). For
     * http callers we DO end the response. Either way the caller's
     * `_proxyIds` mapping for this peer/id is cleared so the next request
     * mints a fresh session.
     * @private
     */
    _handleR(peer, info) {
        if (!info || typeof info.id !== 'string') return true;
        const entry = info.last
            ? peerLink.consumePending(peer, info.id)
            : peerLink.peekPending(peer, info.id);
        if (!entry || !entry.caller) return true;
        const caller = entry.caller;

        if (info.kind === 'close') {
            if (caller.type === 'http') {
                // End-of-stream: flush whatever's buffered and close.
                if (typeof caller.close === 'function') caller.close();
            }
            // Clear the (peer, id) entry so a follow-up request from this
            // caller mints a fresh ProxyClient on the callee.
            if (caller._proxyIds) {
                for (const [p, pid] of caller._proxyIds) {
                    if (p === peer && pid === info.id) caller._proxyIds.delete(p);
                }
            }
            // Counterpart to the increment in Router.proxy: every downstream
            // session ending decrements the outstanding count. We never go
            // negative — defensive clamp.
            if (typeof caller._proxyOutstanding === 'number') {
                caller._proxyOutstanding = Math.max(0, caller._proxyOutstanding - 1);
            }
            // Multi-hop close propagation: when an intermediate hop's last
            // downstream session ends and the hop itself was opened in
            // `request` mode, close it too. Recursively bubbles back to
            // the original entry-point caller.
            const stillOutstanding =
                (caller._proxyIds && caller._proxyIds.size > 0) ||
                (caller._proxyOutstanding > 0);
            if (caller.type === 'proxy' && caller.mode === 'request' &&
                caller.isAlive && !stillOutstanding)
            {
                caller.close();
            }
            return true;
        }

        const fn = caller[info.kind];
        if (typeof fn !== 'function') return true;
        fn.apply(caller, info.args || []);
        return true;
    },

    /**
     * Handle `_proxyrchan`: coalesced channel fan-out. Whitelist-gate the
     * channel name, then call the matching ClientSet method on this side's
     * sub map. This recursively fans out — if our local subs include
     * further ProxyClients on other peer links, those re-coalesce.
     * @private
     */
    _handleRChan(peer, info) {
        if (!info || typeof info.channel !== 'string') return true;
        if (!peerLink.shadowInAllows(peer, info.channel)) {
            // Whitelist denied. Log + drop. Avoid noisy errors so a
            // misconfigured peer can't spam the log per frame.
            if (peer.props && peer.props.logErrors) {
                console.error(`[peerLink] dropped shadow frame: channel '${info.channel}' not in shadowIn whitelist`);
            }
            return true;
        }
        const set = peer.restnio.subs(info.channel);
        const fn = set[info.kind];
        if (typeof fn !== 'function') return true;
        fn.apply(set, info.args || []);
        return true;
    },

    /**
     * Handle `_proxyrsub`: sub state back-prop. The callee's ProxyClient
     * just subscribed/unsubscribed locally — mirror that on the original
     * caller so subsequent shadow frames for that channel are delivered to
     * them.
     * @private
     */
    _handleRSub(peer, info) {
        if (!info || typeof info.id !== 'string') return true;
        const entry = peerLink.peekPending(peer, info.id);
        if (!entry || !entry.caller) return true;
        if (info.op === 'add')         entry.caller.subscribe(info.channel);
        else if (info.op === 'remove') entry.caller.unsubscribe(info.channel);
        return true;
    },

};

module.exports = proxyDispatch;