/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');
const { EventEmitter } = require('events');
const ClientSet = require('./ClientSet');
/**)
 * Typedef Imports
 * @typedef {import("../client/Client")} Client
 * @typedef {import("./ClientSet")} ClientSet
 */

/**
 * @exports SubscriptionMap
 * @class SubscriptionMap
 * @extends Map
 * @author 7kasper
 * @classdesc
 * Special map implementation for subscriptions.
 * SubscriptionMap contains an array of clients based on a key
 * which is the name of the subscription. This allows to easily broadcast messages
 * across many clients. Clients will automatically unsubscribe from subscription services
 * when a connection is lost. Subscription maps are thus an excellent way to
 * manage active and open connections.
 *
 * In addition to the map surface, instances expose a small lifecycle
 * event API so application code can react to channel membership
 * transitions without polling:
 *
 * ```js
 * rnio.subscriptions.on('subscribe',   (name, size, client) => {});
 * rnio.subscriptions.on('unsubscribe', (name, size, client) => {});
 * rnio.subscriptions.on('first',       (name, client)       => {});
 * rnio.subscriptions.on('empty',       (name)               => {});
 * ```
 *
 * - `subscribe`   fires after every add. `size` is the new member count.
 * - `unsubscribe` fires after every remove. `size` is the new member count.
 * - `first`       fires only when the channel transitions from empty → 1.
 * - `empty`       fires only when the channel transitions to 0.
 *
 * Idempotent add/remove (re-adding a client already in the set, or
 * removing one that isn't) does not fire any event — the underlying
 * `Set` swallows the operation and member count is unchanged.
 *
 * The emitter is composed rather than mixed in because the class
 * already extends `Map` and JS doesn't do multiple inheritance.
 */
class SubscriptionMap extends Map {

    constructor() {
        super();
        this._emitter = new EventEmitter();
        // Subscriptions are broadcast-style — many listeners on the same
        // channel name are normal. Disable the default 10-listener cap so
        // larger deployments don't trip Node's leak warning.
        this._emitter.setMaxListeners(0);
    }

    /**
     * Register a lifecycle listener. See the class JSDoc for the
     * available events and their signatures.
     * @param {string}   event
     * @param {Function} fn
     * @returns {this}
     */
    on(event, fn)  { this._emitter.on(event, fn);  return this; }

    /**
     * Remove a lifecycle listener.
     * @param {string}   event
     * @param {Function} fn
     * @returns {this}
     */
    off(event, fn) { this._emitter.off(event, fn); return this; }

    /**
     * Register a one-shot lifecycle listener.
     * @param {string}   event
     * @param {Function} fn
     * @returns {this}
     */
    once(event, fn) { this._emitter.once(event, fn); return this; }

    /**
     * Subscribes a client to a service. Fires `subscribe` (always) and
     * `first` (only on the 0 → 1 transition).
     * @param {string} name - The name of service to subscribe to.
     * @param {Client} client - The client to subscribe.
     */
    subscribe(name, client) {
        const set    = this.get(name);
        const before = set.size;
        set.add(client);
        const after  = set.size;
        if (after === before) return; // already a member — no transition
        this._emitter.emit('subscribe', name, after, client);
        if (before === 0) this._emitter.emit('first', name, client);
    }

    /**
     * Unsubscribes a client from a service. Fires `unsubscribe` (always)
     * and `empty` (only on the n → 0 transition).
     * @param {string} name - The name of service to unsubscribe from.
     * @param {Client} client - The client to subscribe.
     */
    unsubscribe(name, client) {
        const set    = this.get(name);
        const before = set.size;
        set.delete(client);
        const after  = set.size;
        if (after === before) return; // wasn't a member — no transition
        this._emitter.emit('unsubscribe', name, after, client);
        if (after === 0) this._emitter.emit('empty', name);
    }

    /**
     * Gets the clientset belonging to the subscription, creating it on
     * first access. Each ClientSet remembers its `name` so its broadcast
     * methods can pass `(channel, publishId)` down to participating
     * {@link ProxyClient}s for shadow-frame coalescing across peer links.
     *
     * @param {string} name - The name of the subscription.
     * @returns {ClientSet} - the clientset belonging to that subscription.
     */
    get(name) {
        let clientset = super.get(name);
        if (!clientset) {
            clientset = new ClientSet();
            clientset.name = name;
            super.set(name, clientset);
        }
        return clientset;
    }

}
module.exports = SubscriptionMap;
