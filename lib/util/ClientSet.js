/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');
/**
 * Typedef Imports
 * @typedef {import("../client/Client")} Client
 */

/**
 * Module-scoped monotonic counter used to mint per-publish ids. Wraps every
 * 2^31 publishes; collisions are local to a single in-flight publish round
 * (sub-microsecond), so the wrap is harmless. Each {@link ClientSet}
 * broadcast call mints exactly one id; ProxyClients on the same peer who
 * are subscribed to the same channel collapse to a single wire frame keyed
 * by `(channel, publishId)` inside the peer-link shadow buffer.
 */
let _publishCounter = 0;
function nextPublishId() {
    _publishCounter = (_publishCounter + 1) & 0x7fffffff;
    return _publishCounter;
}

/**
 * @exports ClientSet
 * @class ClientSet
 * @extends Set<Client>
 * @author 7kasper
 * @classdesc
 * Special set implementation for clients.
 * Allows the same communication functions for clients but on an entire set.
 *
 * **Channel-aware publish.** When this set is owned by a {@link SubscriptionMap}
 * (the normal case), it carries its own `name` (the channel name). Every
 * broadcast method below mints one publishId per call and forwards it,
 * together with the channel name, to each member as the trailing arguments
 * to whatever client method is being invoked:
 *
 *   `client.obj(payload, channel, publishId)`
 *   `client.str(text,    channel, publishId)`
 *   `client.bin(buffer,  channel, publishId)`
 *   …etc.
 *
 * Plain {@link Client}s ignore the trailing args and behave as before
 * (JavaScript variadic forgiveness). {@link ProxyClient} overrides each
 * method to inspect the `(channel, publishId)` tuple and route through the
 * peer link's shadow buffer — multiple ProxyClients on the same peer +
 * same `(channel, publishId)` collapse to a single wire frame.
 *
 * Manual `forEach`/iteration loops bypass this — they call `c.obj(payload)`
 * directly with one arg, which on a ProxyClient is interpreted as a tagged
 * direct delivery (one wire frame per ProxyClient). That is intentional:
 * an explicit iteration loop is interpreted as the caller wanting per-client
 * semantics.
 */
class ClientSet extends Set {

    //=====================================================\\
    //				       Communications	       	   	   \\
    //=====================================================\\

    /**
     * Ok every client. Channel-aware so a ProxyClient may translate this
     * to a coalesced shadow `ok` on its peer link, replayed on the
     * receiving side as `subs(channel).ok()`.
     */
    ok() {
        const { channel, pid } = this._beginRound();
        this.forEach(client => client.ok(channel, pid));
    }

    /**
     * Sends an object to every member.
     * @param {*} obj - the payload to publish.
     */
    obj(obj) {
        const { channel, pid } = this._beginRound();
        this.forEach(client => client.obj(obj, channel, pid));
    }

    /**
     * JSON-encodes every argument and sends a single string frame.
     */
    json(...args) {
        const { channel, pid } = this._beginRound();
        this.forEach(client => client.json(...args, channel, pid));
    }

    /**
     * Sends a plain string to every member.
     * @param {string} str
     */
    str(str) {
        const { channel, pid } = this._beginRound();
        this.forEach(client => client.str(str, channel, pid));
    }

    /**
     * Sends a buffer (raw bytes) to every member.
     * @param {Buffer} buf
     */
    buf(buf) {
        const { channel, pid } = this._beginRound();
        this.forEach(client => client.buf(buf, channel, pid));
    }

    /**
     * Alias for {@link ClientSet#buf}, mirroring {@link Client#bin}.
     * @param {Buffer} buf
     */
    bin(buf) {
        const { channel, pid } = this._beginRound();
        this.forEach(client => client.bin(buf, channel, pid));
    }

    /**
     * Sends an error + statuscode to every member.
     * @param {*} err
     * @param {number} [code]
     */
    err(err, code) {
        const { channel, pid } = this._beginRound();
        this.forEach(client => client.err(err, code, channel, pid));
    }

    /**
     * Throws an client error in the neat way.
     */
    throwErr(err) {
        if (Array.isArray(err) && err.length > 1) this.err(err[1], err[0]);
        else this.err(err);
    }

    /**
     * Closes every member. For ProxyClients this fans out as a coalesced
     * shadow `close` so the receiving side closes every api client
     * subscribed to that channel — use sparingly; usually individual
     * `client.close()` is what you want.
     * @param {*} [reason]
    */
    close(reason) {
        const { channel, pid } = this._beginRound();
        this.forEach(client => client.close(reason, channel, pid));
    }

    /**
     * Get or set a header property. HTTP-only; ignored by ws/proxy clients
     * — no coalescing applies.
     * @param {string} header
     * @param {string} [value]
     */
    header(header, value) {
        this.forEach(client => client.header(header, value));
    }

    /**
     * Get or set a cookie. HTTP-only; no coalescing.
     * @param {string} name
     * @param {any} [value]
     * @param {CookieOptions} [options]
     */
    cookie(name, value, options) {
        this.forEach(client => client.cookie(name, value, options));
    }

    //=====================================================\\
    //				          Internal	          		   \\
    //=====================================================\\

    /**
     * Compute the channel name + fresh publishId for one broadcast call.
     * When this ClientSet is not owned by a SubscriptionMap (i.e. there is
     * no channel name), `channel` is `undefined` and ProxyClients fall
     * back to per-client tagged delivery.
     * @private
     */
    _beginRound() {
        const channel = this.name;
        const pid = channel ? nextPublishId() : undefined;
        return { channel, pid };
    }

}
module.exports = ClientSet;
module.exports.nextPublishId = nextPublishId;