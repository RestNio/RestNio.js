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

/**
 * Marker key used to wrap Buffer / Uint8Array payloads so they survive a
 * JSON-encoded envelope round-trip. Without the wrap, Node's
 * `Buffer.prototype.toJSON()` emits `{type:'Buffer', data:[byte,...]}`,
 * the receiver parses that back to a plain object, and any consumer
 * that expects bytes (HttpClient.bin → response.write, file-write, etc.)
 * silently mangles the payload.
 *
 * Picked to be improbable as a real app key. The decoder only rehydrates
 * objects that have EXACTLY this key (no siblings) — limits the false-
 * positive blast radius for apps that genuinely transit a key named
 * `__rnbin`.
 */
const BIN_KEY = '__rnbin';

/**
 * Stringify replacer that detects Buffer / Uint8Array on the holder and
 * substitutes a base64 wrapper. `this[key]` reads the ORIGINAL value
 * before Node's `Buffer.prototype.toJSON` has fired, which is what lets
 * us tell a real Buffer from a plain object that just happens to look
 * like `{type:'Buffer', data:[...]}`.
 *
 * @this {object}
 * @param {string} key
 * @param {*} value
 */
function binReplacer(key, value) {
    const orig = this[key];
    if (Buffer.isBuffer(orig)) {
        return { [BIN_KEY]: orig.toString('base64') };
    }
    if (orig instanceof Uint8Array) {
        return { [BIN_KEY]: Buffer.from(orig.buffer, orig.byteOffset, orig.byteLength).toString('base64') };
    }
    return value;
}

/**
 * Parse reviver mirror of {@link binReplacer}. Restores Buffer from any
 * single-key wrapper object.
 *
 * @param {string} _key
 * @param {*} value
 */
function binReviver(_key, value) {
    if (value
        && typeof value === 'object'
        && typeof value[BIN_KEY] === 'string'
        && Object.keys(value).length === 1)
    {
        return Buffer.from(value[BIN_KEY], 'base64');
    }
    return value;
}

/**
 * JSON codec — the default websocket envelope codec.
 * Envelopes always travel as text frames, never binary, so `sniff` is a no-op.
 *
 * Buffer / Uint8Array payloads are transparently base64-wrapped on encode
 * and rehydrated on decode (see {@link BIN_KEY}). This costs ~33% size
 * versus the raw bytes; for bulk binary traffic (file transfers, etc.)
 * the msgpack codec is significantly cheaper.
 *
 * @type {Codec}
 */
module.exports = {
    name: 'restnio.json',
    binary: false,
    available: true,
    /**
     * Encodes an object (or string) to a text-frame payload.
     * Strings pass through unmodified so callers can send plain text.
     * @param {any} obj
     * @returns {string}
     */
    encode(obj) {
        return typeof obj === 'string' ? obj : JSON.stringify(obj, binReplacer);
    },
    /**
     * Decodes a JSON-encoded envelope.
     * @param {Buffer|string} data
     * @returns {any}
     */
    decode(data) {
        return JSON.parse(typeof data === 'string' ? data : data.toString(), binReviver);
    },
    /**
     * JSON envelopes are only delivered on text frames, so a binary frame is
     * never a JSON envelope.
     * @returns {boolean}
     */
    sniff() { return false; }
};
