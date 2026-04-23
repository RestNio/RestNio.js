/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const json = require('./json');
const msgpack = require('./msgpack');

/**
 * A wire-format strategy used by websocket clients to encode outgoing
 * envelopes and decode incoming ones. Codecs are picked per-client at
 * handshake time via the Sec-WebSocket-Protocol header.
 * @typedef Codec
 * @property {string} name - the Sec-WebSocket-Protocol identifier.
 * @property {boolean} binary - whether encode() produces a binary payload.
 * @property {boolean} available - whether this codec's runtime is installed.
 * Lazy/optional codecs (like MessagePack) may be unavailable without breaking imports.
 * @property {(obj: any) => (string|Buffer)} encode - serialize an envelope/object.
 * @property {(data: Buffer|string) => any} decode - deserialize a received envelope.
 * @property {(data: Buffer) => boolean} sniff - cheap check on incoming binary
 * bytes: returns true if they *might* be a control envelope, false if they are
 * definitely raw binary data. JSON codec always returns false (its envelopes
 * never travel on binary frames).
 */

/** @type {Object.<string, Codec>} */
const codecs = {
    [json.name]: json,
    [msgpack.name]: msgpack
};

/**
 * Resolves a subprotocol string to its codec, or null if unsupported or
 * unavailable. An empty / falsy input resolves to the default JSON codec,
 * matching "no Sec-WebSocket-Protocol header" client behavior.
 * @param {string} [subprotocol]
 * @returns {Codec|null}
 */
function resolve(subprotocol) {
    if (!subprotocol) return json;
    const c = codecs[subprotocol];
    if (!c) return null;
    if (!c.available) return null;
    return c;
}

module.exports = { json, msgpack, codecs, resolve };
