# Codec Negotiation (JSON and MessagePack)

The WebSocket wire format is negotiated at handshake time via the `Sec-WebSocket-Protocol` header.

| Protocol header value | Frame type | Notes |
|-----------------------|------------|-------|
| *(none)* or `restnio.json` | Text | Default. Envelopes are UTF-8 JSON. |
| `restnio.msgpack` | Binary | MessagePack envelopes. Requires optional dep `@msgpack/msgpack`. |

The server negotiates automatically — no extra server-side code required.

## JSON (default)

Clients connect without a subprotocol (or explicitly request `restnio.json`). All message envelopes are plain JSON text frames:

```json
{ "path": "/chat", "params": { "text": "hello" }, "token": "<jwt>" }
```

## MessagePack

Install the optional dependency:

```bash
npm install @msgpack/msgpack
```

Clients connect with the `restnio.msgpack` subprotocol. Envelopes are binary MessagePack frames. The server uses a first-byte sniff to distinguish codec envelopes from raw binary data.

> `setBinRoute()` always takes priority over the codec sniff. See [Binary Routing](Binary).

## Codec registry

The codec registry is available for inspection or extension:

```js
RestNio.codecs   // inspect registered codecs or add custom ones
```

---

*[← Binary Routing](Binary) | [Plugins →](Plugins)*
