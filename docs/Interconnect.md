# Interconnect (Server-to-Server)

> Persistent peer connections between RestNio servers, with route definitions
> reused on both sides.

`rnio.interconnect()` opens an outbound websocket from one RestNio server to
another and registers it under a name. The returned **peer** behaves like a
local websocket client of the remote — you can send envelopes (`peer.obj({path, params})`)
and define routes that fire when the remote pushes envelopes back.

## When to use it

You have multiple RestNio servers that need to talk to each other on top of
the clients they each serve directly. Some examples:

- **Edge ↔ aggregator** — a turbine controller running RestNio for its on-site
  ESP devices also needs a persistent uplink to a park-level server that
  coordinates many turbines.
- **Game server ↔ matchmaker** — game shards open peer connections to a
  central matchmaker; the matchmaker pushes match assignments back.
- **Service mesh** — microservices speak the same envelope format and reuse
  one route schema regardless of who initiates the connection.

The same wire format and route shape are used as for normal websocket
clients. Routes you already wrote for browser/ESP clients can be invoked by
peers too.

## Quick example

```js
const RestNio = require('restnio');

// Park: accepts incoming peers and exposes a /setPower route.
const park = new RestNio((router) => {
  router.ws('/setPower', { kw: RestNio.params.number }, ({ kw }, client) => {
    console.log('turbine set to', kw, 'kW');
    client.obj({ path: '/ack', params: { applied: kw } });
  });
}, { port: 7000 });
park.bind();

// Turbine: opens a persistent uplink to park.
const turbine = new RestNio(() => {}, { port: 7100 });
turbine.bind();

turbine.interconnect('park', 'ws://localhost:7000', {
  onConnect: () => console.log('linked to park'),
  routes: (router) => {
    // /ack is registered on the turbine's main route table — the same ESPs
    // connecting locally can also hit it. Default behavior; see "Routing
    // model" below to opt out of sharing.
    router.ws('/ack', { applied: RestNio.params.number }, ({ applied }) => {
      console.log('park acknowledged setpoint:', applied);
    });
  },
});

turbine.inter('park').obj({ path: '/setPower', params: { kw: 1500 } });
```

## API

### `rnio.interconnect(name, url, options?)`

Opens a peer connection and registers it under `name`. Returns the
`InterClient`.

```js
rnio.interconnect('park', 'ws://park.local/', {
  // codec subprotocol — defaults to 'restnio.json'
  subprotocol: 'restnio.json',

  // JWT sent as Authorization: Bearer <token> on the upgrade request,
  // so the *remote* can grant the peer permissions.
  token: parkJwt,

  // permissions granted *locally* — applied to the peer's permission set so
  // peer-scoped routes can use permission checks on incoming envelopes.
  permissions: ['park.command.*'],

  // exponential-backoff reconnect (defaults shown)
  reconnect: { enabled: true, minDelay: 500, maxDelay: 30000, factor: 2, jitter: 0.2 },

  // lifecycle hooks
  onConnect: (peer) => {},
  onClose:   (reason, peer) => {},  // reason = [code, reasonString]
  onError:   (err, peer) => {},

  // route registration — see "Routing model" below
  routes: (router, peer) => {
    router.ws('/cmd', () => { /* … */ });
  },

  // opt in to a peer-private route table (see "Isolated mode")
  isolate: false,
});
```

### `rnio.inter(name)`

Looks up a registered peer by name. Throws if no peer with that name exists.

```js
rnio.inter('park').obj({ path: '/turbine/heartbeat', params: { rpm: 12 } });
```

### `peer.obj(env)` / `peer.str(s)` / `peer.bin(buf)` / `peer.json(...)`

Send an envelope (or raw string / binary frame) to the remote. These mirror
the same methods on a local websocket client. Frames sent before the socket
reaches `OPEN` are buffered and flushed in order on connect — the user-facing
guarantee is "envelopes I sent at startup will reach the remote".

### `peer.close(reason?)`

Closes the connection and **disables further reconnects**. Pass a reason
string or a `[code, reason]` tuple to control the close frame.

### `peer.reopen()`

Restarts the connection. Resets the retry counter, re-arms reconnects, and
opens a new socket if there isn't one in flight already. Use this from an
`interFail` or `interClose` handler to recover after the automatic retry
budget has been exhausted, or to force a reconnect after a remote
maintenance window.

### `peer.status` / `peer.isOpen`

Read-only state of the peer.

| `peer.status`   | Meaning |
|-----------------|---------|
| `'connecting'`  | Initial state, or trying again after a close. |
| `'open'`        | Socket is OPEN and delivering frames. |
| `'closed'`      | Socket closed; reconnects may still be scheduled. |
| `'failed'`      | `maxAttempts` exhausted — no further retries until `peer.reopen()`. |
| `'shut'`        | `peer.close()` was called explicitly; terminal until `peer.reopen()`. |

`peer.isOpen` is sugar for `peer.status === 'open'`.

```js
if (rnio.inter('park').isOpen) rnio.inter('park').obj({ path: '/heartbeat' });
```

## Routing model

A peer connection is symmetric: envelopes flow both ways over the same
socket. Outgoing envelopes (`peer.obj(...)`) are routed by the **remote**
server. Incoming envelopes — pushes from the remote — are dispatched
locally.

By default, routes registered through `peer.router` write into the main
`rnio.routes` table — exactly the same place `rnio.router.ws(...)` writes
to. This is the typical case: when a turbine talks to a park they have
distinct schemas, so `/setPower` on the turbine and `/registerTurbine` on
the park don't collide. Sharing the table means a route written once is
reachable both by the peer push and by any local client that needs it.

```js
turbine.interconnect('park', parkUrl, {
  routes: (router) => {
    // Reachable by: park pushing { path: '/setPower', params: ... }, AND
    // any local ws/HTTP client hitting the turbine's main socket.
    router.ws('/setPower', { kw: RestNio.params.number }, ({ kw }) => motor.set(kw));
  },
});
```

The peer's router supports the full `router.ws*` and `router.wsBin*` API.
HTTP-only routes don't make sense on a peer connection (the underlying
transport is a websocket) and are silently ignored.

### Isolated mode

When two **identical** RestNio services talk to each other (sibling-to-sibling
replication, mesh peers running the same code) the route names *do* clash.
For those cases pass `isolate: true` and the peer keeps a private route map.
Routes go into that map; peer envelopes dispatch through it; nothing leaks
into `rnio.routes` and nothing from `rnio.routes` is reachable by the peer.

```js
turbine.interconnect('sibling-turbine', siblingUrl, {
  isolate: true,
  routes: (router) => {
    // Only fires for envelopes pushed by the sibling over THIS peer link.
    // Local ESPs hitting the turbine's main websocket get a 404 for /sync.
    router.ws('/sync', (params) => syncState(params));
  },
});
```

Isolated mode is also useful when you want a strict security boundary: a
peer can only invoke routes you explicitly register on its private map.

### Mixing isolated + shared routes

In isolated mode the peer also exposes `peer.mainRouter`, which always
points at `rnio.router`. Use it to register *some* routes on the main
table while keeping the rest peer-private:

```js
turbine.interconnect('park', parkUrl, {
  isolate: true,
  routes: (router, peer) => {
    // Peer-only — only park can reach this.
    router.ws('/setPower', () => motor.set(...));

    // Also reachable by local ESPs.
    peer.mainRouter.ws('/heartbeat', () => ({ alive: true }));
  },
});
```

## Lifecycle routes

Peers expose three connection-lifecycle routes that mirror the existing
`wsConnect` / `wsClose` pattern. Register handlers with `router.on(...)` —
they receive `(params, peer)` so a single handler can fan out across
multiple named peers.

| Route        | When it fires | `params` |
|--------------|---------------|----------|
| `interOpen`  | Socket reaches OPEN. Fires once on first connect and once per successful reconnect. | `{ url, attempts }` |
| `interClose` | Underlying socket closed. Fires whether the close was initiated by the remote, the network, or a local `peer.close()`. | `{ code, reason, attempts }` |
| `interFail`  | `reconnect.maxAttempts` exhausted. Fires once and the peer enters the `'failed'` state — no further auto-reconnects until `peer.reopen()`. | `{ attempts, lastError }` |

```js
turbine.interconnect('park', parkUrl, {
  reconnect: { maxAttempts: 5 },
  routes: (router) => {
    router.on('interOpen',  (p, peer) => log.info('linked',     peer.name, p));
    router.on('interClose', (p, peer) => log.warn('lost',       peer.name, p));
    router.on('interFail',  (p, peer) => {
      log.error('peer failed', peer.name, p);
      // Schedule a *much* slower retry — e.g. wait 5 minutes before trying again.
      setTimeout(() => peer.reopen(), 5 * 60 * 1000);
    });
  },
});
```

The plain callback form (`onConnect`, `onClose`, `onError` in the options
object) still works and fires alongside the route handlers — useful when
you want a closure-scoped reaction without registering a route. Route
handlers go through the full RestNio routing machinery (param checks,
permissions, etc.) and are the recommended path for anything beyond
trivial logging.

## Reconnect behavior

Peers auto-reconnect with exponential backoff. Each retry waits
`min(maxDelay, minDelay * factor ^ attempt)` milliseconds, with `±jitter`
randomness applied to spread out reconnects across many peers.

| Option         | Default    | Meaning |
|----------------|------------|---------|
| `enabled`      | `true`     | Disable to give up after the first close. |
| `minDelay`     | `500`      | First retry delay (ms). |
| `maxDelay`     | `30000`    | Cap on retry delay. |
| `factor`       | `2`        | Multiplicative growth per attempt. |
| `jitter`       | `0.2`      | ± random ratio applied to each computed delay. |
| `maxAttempts`  | `Infinity` | After this many consecutive failed connects, fire `interFail` and stop retrying. Use `peer.reopen()` to start over. |

Frames sent while disconnected are buffered and replayed on reconnect, in
the order they were submitted. Use `peer.close()` to permanently shut a
peer down — that path skips reconnect.

```js
// Only retry 5 times, then give up and let the application decide what to do.
turbine.interconnect('park', parkUrl, {
  reconnect: { maxAttempts: 5 },
  routes: (router) => {
    router.on('interFail', (_, peer) => {
      // …e.g. schedule a much slower outer retry, raise an alert, shut down, etc.
      setTimeout(() => peer.reopen(), 60_000);
    });
  },
});
```

## Auth and permissions

The peer connection's JWT is sent as `Authorization: Bearer <token>` on the
upgrade request. The remote treats it like any other websocket client token
and grants permissions accordingly — so a turbine peer can hold a token
with `park.cmd.*` while a sibling-turbine peer holds something narrower.

The `permissions` option grants permissions to the peer **locally** —
applied to the peer's own permission set so peer-scoped routes can use
permission checks without depending on a JWT.

## Limitations and design notes

- **Fire-and-forget for now.** `peer.obj()` does not return a promise; if
  you need request/response correlation, the remote needs to push back an
  envelope explicitly (e.g. `client.obj({ path: '/ack', params: {...} })`)
  and the local peer dispatches that as a normal incoming envelope. A
  proper `.call()` with envelope ID correlation is on the roadmap.
- **One peer per name.** Re-registering an existing name throws — close the
  existing peer first.
- **Peer routes are evaluated as `WS:` routes.** HTTP-only verbs registered
  on a peer router are silently dropped because no HTTP transport exists
  on the peer side.

---

*[← Outbound Connectors](Connectors) | [Default Routes →](Default-Routes)*
