# WebSocket Basics

## A fundamentally different model

Most WebSocket frameworks treat the connection as a raw stream and leave message routing entirely up to you. RestNio takes a different approach: **the WebSocket connection is a first-class, server-wide transport**, and individual messages behave just like HTTP requests.

When a client connects over WebSocket, it sends JSON envelopes like:

```json
{ "path": "/chat", "params": { "text": "hello" }, "token": "<jwt>" }
```

RestNio dispatches that exactly as if it were `POST /chat` — the same route match, the same param validation, the same permission check. Routes defined with `router.get()`, `router.post()`, etc. respond to both HTTP and WebSocket messages out of the box. Routes defined with `router.ws()` are WebSocket-only.

### Why this matters

| | Express-style WS | RestNio |
|--|--|--|
| Message routing | You write a switch/if chain | Route map, same as HTTP |
| Param validation | Manual | Full `params` schema on every route |
| Auth/permissions | Manual | Same JWT system, same `permissions` array |
| Code sharing | Duplicate or extract helpers | One route definition for both |
| Server → client push | You manage all sockets | `client.obj()` anywhere, subscriptions |

This makes RestNio ideal for building **RPC-style APIs over WebSocket** — every route is a callable procedure with validated inputs and typed outputs. You get the full power of HTTP-style routing with the real-time capabilities of WebSocket, and you can share almost every route between REST and WS clients.

## Server → client push

Unlike HTTP, a WebSocket connection stays open, so the server can send messages at any time — not just as a response. All `client.send*` methods work outside of a route handler too (e.g. after a database event fires):

```js
router.ws('/subscribe-price', (params, client) => {
  client.state.watchedSymbol = params.symbol;
  client.subscribe('prices');
  return { watching: params.symbol };
});

// Called from elsewhere — e.g. a price-feed callback
function onPriceUpdate(symbol, price) {
  rnio.subs('prices').obj({ symbol, price, ts: Date.now() });
}
```

```js
// Fires for every connecting client — return value is sent as MOTD
router.on('wsConnect', () => ({ motd: 'welcome!' }));

// Fires on disconnect — params.reason is [closeCode, message]
router.on('wsClose', (params) => {
  console.log('client left:', params.reason);
});
```

Multiple `wsConnect` handlers are all fired in order, each sending a separate message to the client.

## Message routing

Clients send `{ path, params?, token? }` and the matching `router.ws()` handler runs:

```js
router.ws('/ping', () => ({ pong: true }));

router.ws('/echo', (params) => ({ echo: params.message }));
```

## Sending from the server side

```js
router.ws('/demo', (params, client) => {
  client.str('raw string');            // send a text frame
  client.obj({ hello: 'world' });      // codec-encoded frame (JSON by default)
  client.bin(Buffer.from([1, 2, 3])); // send a binary frame
  client.close([1000, 'bye']);          // close with code + reason
});
```

## Connection-level state

`client.state` is a free-form bag that persists for the lifetime of the WebSocket connection. RestNio never reads or writes it:

```js
router.ws('/init', (params, client) => {
  client.state.userId   = params.userId;
  client.state.joinedAt = Date.now();
  return { ready: true };
});

router.ws('/profile', (params, client) => ({
  userId: client.state.userId,
  ageMs:  Date.now() - client.state.joinedAt
}));
```

For HTTP routes, `client.state` is request-scoped (a fresh object for each request).

## Subscriptions and broadcasting

`client.subscribe(name)` adds the client to a named group. `rnio.subs(name)` returns a `ClientSet` — an iterable `Set` that also exposes broadcast helpers (`.str()`, `.obj()`, `.bin()`). The map auto-creates an empty set for unknown rooms, so iteration is always safe.

```js
router.ws('/join', (params, client) => {
  client.subscribe(params.room || 'main');
  return { joined: params.room || 'main' };
});

router.ws('/leave', (params, client) => {
  client.unsubscribe(params.room || 'main');
  return { left: params.room || 'main' };
});

// Broadcast helpers — one call reaches all clients in the room
router.ws('/announce', (params) => {
  rnio.subs(params.room).str(params.message);
  return { sent: true };
});

// For per-client logic, iterate the set directly
router.ws('/notify', (params, client) => {
  for (const c of rnio.subs('main')) {
    c.obj({ from: client.state.name, text: params.text });
  }
  return { sent: true };
});
```

## ClientSet broadcast API

`rnio.subs(name)` returns a `ClientSet` with these helpers:

| Method | Description |
|--------|-------------|
| `.str(s)` | Send a plain text frame to all members |
| `.obj(o)` | Send a codec-encoded frame to all members |
| `.bin(buf)` | Send a binary frame to all members |
| `.ok()` | Send `{ ok: true }` to all members |
| `.err(e, code)` | Send `{ error: e, code }` to all members |

`ClientSet` is a standard `Set` — you can iterate it, check `.size`, etc.

---

*[← Auth & Permissions](Auth) | [Binary Routing →](Binary)*
