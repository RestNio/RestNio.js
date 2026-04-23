# Binary WebSocket Routing

By default, unhandled binary frames trigger the built-in `wsBin` error route (throws `400`). Override it or route frames to named handlers.

## Named binary route (upload pattern)

```js
// 1) Client sends a JSON envelope to begin the upload
router.ws('/upload-start', (params, client) => {
  client.state.file         = Buffer.alloc(0);
  client.state.expectedSize = params.size || 0;
  client.setBinRoute('file');          // all subsequent binary frames → wsBin-file
  return { acceptingBinary: true };
});

// 2) Each binary frame arrives here
router.wsBin('file', (params, client) => {
  // params.data — the raw Buffer for this frame
  // params.size — byte length of this frame
  client.state.file = Buffer.concat([client.state.file, params.data]);
  if (client.state.file.length >= client.state.expectedSize) {
    const size = client.state.file.length;
    client.clearBinRoute();            // stop routing to wsBin-file
    client.state.file = null;
    return { uploaded: size };
  }
  // no return → stay in binary-receive mode
});

// 3) Client can cancel at any time
router.ws('/upload-cancel', (params, client) => {
  client.clearBinRoute();
  client.state.file = null;
  return { cancelled: true };
});
```

## Default binary fallback

Override the catch-all for any binary frame that has no active `setBinRoute`:

```js
router.wsBin((params) => {
  console.log('stray binary frame, size:', params.size);
  return { stray: true, size: params.size };
});
```

## API summary

| API | Description |
|-----|-------------|
| `router.wsBin(handler)` | Default binary fallback route |
| `router.wsBin(name, handler)` | Named binary route (`wsBin-<name>`) |
| `client.setBinRoute(name)` | Route all incoming binary frames to `wsBin-<name>` |
| `client.clearBinRoute()` | Return to default binary behavior |

Named and default handlers both receive `{ data: Buffer, size: number }`.

## How it interacts with codecs

If the client negotiated MessagePack (`restnio.msgpack` subprotocol), binary frames are first inspected for a codec envelope. If the frame matches, it is decoded as a normal message envelope. If it does not match (or a `setBinRoute` is active), it is treated as raw binary data. `setBinRoute` always takes priority.

See [Codec Negotiation](Codecs) for details.

---

*[← WebSocket Basics](WebSocket) | [Codec Negotiation →](Codecs)*
