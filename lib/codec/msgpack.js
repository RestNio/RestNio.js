/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

/**
 * @typedef {import('./index').Codec} Codec
 */

// @msgpack/msgpack is an optionalDependency: if it isn't installed we still
// expose the codec object (so `resolve()` can report it as unavailable), but
// attempts to encode/decode throw a clear error instead of a generic MODULE_NOT_FOUND.
let impl = null;
try {
    impl = require('@msgpack/msgpack');
} catch (_) {
    // Left null — `available` stays false.
}

function requireImpl() {
    if (!impl) throw new Error(
        "MessagePack codec requested but the '@msgpack/msgpack' package is not installed. " +
        "Run `npm install @msgpack/msgpack` to enable the 'restnio.msgpack' subprotocol."
    );
    return impl;
}

/**
 * MessagePack codec. Envelopes travel as binary frames because MessagePack
 * payloads are arbitrary bytes and not valid UTF-8. This means binary frames
 * are ambiguous — the `sniff` method disambiguates by checking that the first
 * byte falls inside MessagePack's top-level-map range (0x80–0x8f, 0xde, 0xdf).
 * A restnio envelope is always a map with at least a `path` key, so the decode
 * path then additionally verifies the shape before dispatching.
 * @type {Codec}
 */
module.exports = {
    name: 'restnio.msgpack',
    binary: true,
    get available() { return impl !== null; },
    /**
     * @param {any} obj
     * @returns {Buffer}
     */
    encode(obj) {
        return Buffer.from(requireImpl().encode(obj));
    },
    /**
     * @param {Buffer} data
     * @returns {any}
     */
    decode(data) {
        return requireImpl().decode(data);
    },
    /**
     * Cheap first-byte check — returns true if `data` could be a top-level
     * MessagePack map (fixmap / map16 / map32). Used on the hot path so the
     * server avoids attempting a full decode on every binary chunk.
     * @param {Buffer} data
     * @returns {boolean}
     */
    sniff(data) {
        if (!data || data.length === 0) return false;
        const b = data[0];
        return (b >= 0x80 && b <= 0x8f) || b === 0xde || b === 0xdf;
    }
};
