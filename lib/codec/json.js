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
 * JSON codec — the default websocket envelope codec.
 * Envelopes always travel as text frames, never binary, so `sniff` is a no-op.
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
        return typeof obj === 'string' ? obj : JSON.stringify(obj);
    },
    /**
     * Decodes a JSON-encoded envelope.
     * @param {Buffer|string} data
     * @returns {any}
     */
    decode(data) {
        return JSON.parse(typeof data === 'string' ? data : data.toString());
    },
    /**
     * JSON envelopes are only delivered on text frames, so a binary frame is
     * never a JSON envelope.
     * @returns {boolean}
     */
    sniff() { return false; }
};
