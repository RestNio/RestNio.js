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

## Reserved envelope fields

Beside the route-dispatch fields (`path`, `params`, `token`), the envelope
schema reserves a small set of underscore-prefixed fields for internal
protocol use. They are honored only on peer links and bypass normal
path-routing.

| Field   | Type     | Purpose |
|---------|----------|---------|
| `_actor` | `Object` | Carries an upstream caller's identity claim across a relay hop. See "Per-envelope actor scoping" below. |
| `_type`  | `string` | Tags the envelope as internal-protocol traffic. Currently used by `subBridge` (`'sub.frame'`). Future versions may add more types — names follow the `<feature>.<op>` convention. |

Application envelopes never set these fields; if an inbound frame on a regular
WS client sets them, they are ignored.

## Per-envelope actor scoping (`_actor`)

The relay topology — `client → entry-server → peer-link → upstream-server` —
needs the upstream to make permission decisions on behalf of the *original*
caller, not the entry server. RestNio supports this with a single envelope
field: `_actor`.

```
{ path, params, _actor: { sub: 'kasper', perms: ['pitch.motor', 'pitch.pid'] } }
```

When an envelope carrying `_actor` arrives on an `InterClient` (a peer link),
RestNio:

1. **Clamps** `_actor.perms` against the peer's connection permissions
   (`PermissionSet.intersect`). The peer link's own perms are the **cap** —
   relayed callers can never gain more than the peer itself was granted.
2. Exposes the original claim on `client.actor` (concurrency-safe across
   awaits via `AsyncLocalStorage`).
3. Uses the clamped set for the route's `permissions` check (instead of the
   peer's own perms), via `client.effectivePermissions`.
4. Restores defaults when dispatch finishes — the connection's own perm set
   stays untouched.

```js
// On the receiving (upstream) server:
turbine.interconnect('central', centralUrl, {
  // Cap the relay surface. Frames carrying _actor cannot grant more than this,
  // even if a misbehaving central injects broader claims.
  permissions: ['pitch.*'],
});

router.ws('/pitch/cmd/motor', {
  permissions: ['pitch.motor'],
  func: (params, client) => {
    // client.actor.sub  → original caller's id (e.g. 'kasper')
    // client.effectivePermissions → clamped perm set used for this dispatch
    actuate(params);
  },
});
```

Trust gate: `_actor` is only honored when `client.type === 'inter'`. A regular
WebSocket client cannot impersonate via `_actor` — the field is silently
ignored.

```js
// Receiving the original claim in a route handler:
router.ws('/pitch/cmd/motor', {
  permissions: ['pitch.motor'],
  func: (params, client) => {
    log.info(`motor cmd by ${client.actor?.sub ?? 'direct-client'}`);
  },
});
```

### Clamp examples

| Cap (peer perms)   | `_actor.perms` (claimed) | Effective set (clamped)      |
|--------------------|--------------------------|------------------------------|
| `pitch.*`          | `pitch.motor`            | `pitch.motor` (kept)          |
| `pitch.*`          | `admin.flash`            | `[]` (dropped — disjoint)     |
| `pitch.set_telem`  | `pitch.*`                | `pitch.set_telem` (clamped down) |
| `*`                | `pitch.motor`            | `pitch.motor` (kept verbatim) |

Caller-broader perms get clamped *down* to the cap — they never extend it.

## `router.proxy()` — generic relay routes

`router.proxy(prefix, opts)` registers a single catch-all that forwards
everything under `prefix` (HTTP + WS) to a target peer or client set. It
replaces the boilerplate of enumerating verbs at every hop in a multi-server
chain.

```js
// On the entry server, forward /turbine/:id/<anything> to the right park peer.
router.proxy('/turbine/:turbineID', {
  target:      (params) => [...rnio.subs(`park-of-${params.turbineID}`)][0],
  permissions: ['turbine.:turbineID'],
});
```

What it does behind the scenes:

- Registers on `${prefix}/:rest*` so any descendant matches.
- Resolves `opts.target`. If a function, called as `target(params, client)`;
  otherwise used directly. Must yield anything with an `.obj()` method
  (single `Client`, peer, or `ClientSet`).
- Builds an envelope: `{ path: '/' + rest, params, _actor }` and pushes via
  `target.obj(...)`. The captured `:rest*` is stripped from the forwarded
  params (it was the path).
- **Actor propagation**: if the calling client already has a `client.actor`
  (relayed from further upstream), it's preserved verbatim. Otherwise a fresh
  one is minted from `{ sub: client.token.sub, perms: [...client.permissions] }`.
  The proxy is the trust boundary that vouches for the caller.
- Returns `[503, 'upstream offline']` when the target is missing/falsy.
- HTTP callers get `{ ok: true, forwarded: true }` (the connection has to
  close cleanly). WS callers get no synthetic reply — they correlate via
  separate channels (e.g. bridged sub frames or dedicated ack paths).

### Permission gate at the hop

The `permissions` field gates the relay at this hop **on the calling client**
(not the upstream). Standard route perm checking applies, including `:param`
substitution. Typical: `permissions: ['turbine.:turbineID']` for per-turbine
ACL at the entry point.

### No reply correlation in v1

Proxy is fire-and-forget. The caller gets back what `target.obj()` returns
(a synthetic ack for HTTP, nothing for WS). For request/response patterns
through a relay, send the response on its own channel — typically as a
[bridged sub frame](#subbridge--cross-link-pubsub).

## `subBridge` — cross-link pub/sub

A peer link doubles as a publication transport: `client.subBridge(opts)`
attaches a bridge that forwards local `subs(channel).obj(...)` traffic over
the wire and re-publishes inbound `sub.frame` envelopes locally. The endpoint
boilerplate of "for each event, register a route, broadcast to subs" collapses
to one bridge call.

```js
// Outbound peer (e.g. turbine → park).
const park = rnio.interconnect('park', 'ws://park.local/');
park.subBridge({
  prefix:   'wt1',                  // local 'telem' → remote 'wt1.telem'
  out:      ['telem', 'event'],     // local emits flow OUT to peer
  in:       ['cmd_broadcast'],      // peer emits flow IN, re-published locally
});

// Inbound peer (the same socket, on the other server).
router.on('wsConnect', (_p, client) => {
  client.subBridge({
    in:  ['wt1.telem', 'wt1.event'],
    out: ['cmd_broadcast'],
  });
});

// Local emitters stay agnostic — no peer-awareness needed.
rnio.subs('telem').obj({ rpm: 12, t: 100 });
```

### Options

| Option     | Type                       | Meaning |
|------------|----------------------------|---------|
| `out`      | `string[]` \| `'*'`        | Local sub channels whose frames flow OUT to the peer. `'*'` mirrors every channel known to the SubscriptionMap, including ones created later. |
| `in`       | `string[]` \| `'*'`        | Sub frames received FROM the peer that get re-published locally. `'*'` accepts any channel name. |
| `prefix`   | `string` (optional)        | Applied to OUT channel names: local `telem` → remote `<prefix>.telem`. Use to namespace per-source in tree topologies. |
| `onDemand` | `boolean` (reserved)       | Reserved for future ref-count-driven subscribe/unsubscribe control. v1 forwards always. |

### How it works

- **Out flow**: bridge subscribes a virtual subscriber to each local OUT
  channel. When `subs(channel).obj(payload)` fires locally, the virtual
  subscriber wraps the payload as `{ _type: 'sub.frame', channel: <prefixed>,
  payload }` and pushes it via the peer-link client.
- **In flow**: peer-link's envelope dispatcher detects `_type: 'sub.frame'`
  and routes it to the bridge, which re-publishes via `subs(channel).obj(payload)`.
- Local emitters and local subscribers stay agnostic — bridges are transparent.

### What's forwarded

The bridge mirrors the `ClientSet` fan-out API on its OUT proxy. All the
common pub/sub methods land on the wire:

| `subs(channel).<method>` | Bridged | Notes |
|--------------------------|---------|-------|
| `.obj(payload)`          | ✅      | The default. Payload travels as `_type:'sub.frame'`. |
| `.str(s)`                | ✅      | Wraps the string verbatim as the payload. |
| `.json(...args)`         | ✅      | Single-arg form sends the value; multi-arg sends the args array. |
| `.bin(buf)` / `.buf(buf)` | ❌     | NOT bridged. See "Binary" below. |
| `.err(msg, code)`        | —       | No-op on the bridge proxy. Connection-level semantics, not channel data. |
| `.ok()` / `.close()`     | —       | No-op (connection-level). |

Local subscribers on the receiving server see the value in whatever shape the
sender used — the bridge does not transform payloads, just envelopes them.

### Binary pub/sub: not supported out of the box

The `_type:'sub.frame'` envelope is JSON-encoded text on the wire, so binary
buffers can't ride it without losing fidelity. The bridge logs a one-time
warning per channel when `subs(channel).bin/.buf` is called and drops the
frame:

```
[restnio/SubBridge] subs('telem').bin/.buf is not bridged (channel 'wt1.telem').
sub.frame is JSON-encoded; wire your own binary transport for binary pub/sub.
```

If you need binary fan-out across a peer link, build it yourself — the
underlying peer connection supports binary frames natively. Two patterns
that work:

1. **Direct binary route on the peer.** Register a normal binary route
   (`router.wsBin('chunk', handler)`) on both ends, push from the source via
   `peer.bin(buf)` (after `peer.setBinRoute('chunk')`), and have the receiver
   re-publish locally however you like. This sidesteps subBridge entirely.
2. **Base64 in `obj` payload.** If frames are small and bandwidth isn't
   critical, encode the buffer as base64 and let it ride the JSON envelope:
   `subs('chunk').obj({ b64: buf.toString('base64') })`. Receivers decode.

Future versions may add a `'sub.binframe'` type using a binary codec —
follow the roadmap if you need it standardized.

### Echo guard

A given bridge enforces that a channel is **either** OUT or IN, never both.
Listing the same name in `out` and `in` throws at construction time. If you
need duplex traffic on related channels, use distinct names per direction
(`telem` outbound, `cmd_broadcast` inbound).

### Wildcards

`out: '*'` is convenient for hub-style nodes (e.g. a park forwarding every
turbine's prefixed channels upstream) but greedy — it catches *every* channel
the SubscriptionMap holds, including any internal/non-application ones. Only
use in trusted topologies where you own channel naming hygiene.

`in: '*'` accepts any channel name from the peer. Receive-side names are
not remapped; the wire name is the local name.

### Composing in a tree topology

Each hop attaches its own bridge with its own prefix; the resulting channel
name reflects the path:

```
turbine emits 'telem'
   ↓ turbine→park bridge: prefix 'wt1', out ['telem']
park sees   'wt1.telem'
   ↓ park→central bridge: prefix 'park1', out '*'
central sees 'park1.wt1.telem'
   ↓ api client subscribes 'park1.wt1.telem'  → receives payload
```

No transitive logic in the framework — each hop only knows its neighbor.

### Tear-down

The returned bridge instance has `.teardown()` to detach. Calling `subBridge`
again on the same client tears the previous one down before installing the
new bridge.

```js
const bridge = peer.subBridge({ out: ['telem'] });
// later …
bridge.teardown();
```

## Limitations and design notes

- **Fire-and-forget for now.** Both `peer.obj()` and `router.proxy()` are
  push-only; replies travel back as separate envelopes (typically as bridged
  sub frames or via dedicated ack routes). A proper `.call()` with envelope
  ID correlation is on the roadmap.
- **One peer per name.** Re-registering an existing name throws — close the
  existing peer first.
- **Peer routes are evaluated as `WS:` routes.** HTTP-only verbs registered
  on a peer router are silently dropped because no HTTP transport exists
  on the peer side.
- **`_actor` requires `client.type === 'inter'`.** Only the **outbound**
  side of a peer link honors it on receive. In a relay where commands flow
  *downward* (e.g. central → park → turbine) and the receiving end needs to
  perm-check the original caller, the receiving server must be the one that
  called `interconnect()` — i.e. **leaves open connections upward**. With
  `turbine.interconnect('park', ...)` and `park.interconnect('central', ...)`,
  every downward push lands on the receiver's `InterClient` (type='inter')
  and `_actor` scoping fires correctly. The reverse direction (parent
  initiates) leaves the leaf with a plain `WebSocketClient` and `_actor`
  gets ignored.
- **`subBridge` `onDemand` is reserved.** v1 forwards configured channels
  unconditionally. Bandwidth-saving ref-count-driven subscribe/unsubscribe
  via `_type: 'sub.ctrl'` envelopes is on the roadmap.

---

*[← Outbound Connectors](Connectors) | [Default Routes →](Default-Routes)*
