/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');
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
 */
class SubscriptionMap extends Map {

    /**
     * Subscribes a client to a service.
     * @param {string} name - The name of service to subscribe to.
     * @param {Client} client - The client to subscribe.
     */
    subscribe(name, client) {
        this.get(name).add(client);
    }

    /**
     * Unsubscribes a client from a service.
     * @param {string} name - The name of service to unsubscribe from.
     * @param {Client} client - The client to subscribe.
     */
    unsubscribe(name, client) {
        this.get(name).delete(client);
    }

    /**
     * Gets the clientset belonging to the subscription.
     * @param {string} name - The name of the subscription.
     * @returns {ClientSet} - the clientset belonging to that subscription.
     */
    get(name) {
        let clientset = super.get(name);
        if (!clientset) {
            clientset = new ClientSet();
            super.set(name, clientset);
            // Notify wildcard listeners that a new channel was created. Used
            // by {@link SubBridge} when bridging `out: '*'` so newly-emerging
            // channels start forwarding immediately.
            if (this._channelListeners) {
                for (const l of this._channelListeners) l('add', name);
            }
        }
        return clientset;
    }

    /**
     * Registers a listener that fires whenever a *new* channel is created
     * inside this map. Existing channels are replayed synchronously at
     * registration time so the listener gets a complete picture.
     *
     * Used by features that need to attach to every channel transparently
     * (e.g. wildcard sub-bridging). Note: existing channels do NOT trigger an
     * 'add' event automatically when listeners arrive — replayed instead so
     * the caller sees them all.
     *
     * @param {(action: 'add', channel: string) => void} listener
     */
    onChannelCreate(listener) {
        if (!this._channelListeners) this._channelListeners = new Set();
        this._channelListeners.add(listener);
        // Replay so the listener gets every existing channel.
        for (const name of this.keys()) listener('add', name);
    }

    /**
     * Detaches a listener registered with {@link onChannelCreate}.
     * @param {Function} listener
     */
    offChannelCreate(listener) {
        if (this._channelListeners) this._channelListeners.delete(listener);
    }

}
module.exports = SubscriptionMap;