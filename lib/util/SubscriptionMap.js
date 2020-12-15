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
        }
        return clientset;
    }

}
module.exports = SubscriptionMap;