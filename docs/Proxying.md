# Proxying

RestNio has a built-in mechanism for transparently relaying requests between
servers connected by a peer link (an `InterClient`). The relay covers HTTP,
WebSocket, subscriptions, and pub/sub fan-out — all from a single
`router.proxy()` declaration on the relaying server. Server code on the
upstream side does not need any extra knowledge of where its caller came from:
a proxied caller is materialised as a `ProxyClient` that participates in the
local subscription map and behaves indistinguishably from a `WebSocketClient`
from the perspective of route handlers.

## When to use it

The two-server example throughout this page is *central ↔ turbine*: an
office-side aggregator (central) accepts API clients and forwards a
prefixed slice of routes (`/turbine/WT1/*`) to one turbine running on the
plant floor.

```
                api.local                 plant.local
              ┌──────────┐               ┌───────────┐
   client ──▶ │  central │ ◀─peer link─▶ │  turbine  │
              └──────────┘               └───────────┘
```

The *caller side* is `central`: it receives requests from API clients and
forwards them. The *callee side* is `turbine`: it owns the routes and the
in-process state. With proxying enabled, `turbine` treats every proxied
caller as a real client object — `client.subscribe('pitch')`,
`client.state.x = y`, returning a value, calling `client.obj(...)` later
all work transparently.

## Setup

### 1. Open a peer link from the upstream side

The callee opens an outbound peer link to the caller. Configure shadow
whitelists at this point — they are the trust gate for proxied channel
fan-out in either direction.

```js
const turbine = new RestNio((router, rnio) => { /* ... */ });
turbine.interconnect('central', 'wss://central.example/', {
    shadowOut: ['WT1.*'],            // we may broadcast WT1.* upward
    shadowIn:  ['cmd_broadcast.*'],  // central may broadcast these to us
});
```

### 2. Register the inbound peer connection

When the peer link opens, the central server sees an inbound `WebSocketClient`.
Promote it to a peer link by calling `client.linkAsPeer({...})` after
authenticating, and decide on per-link permissions there.

```js
// central server
router.ws('/peer/register', { pwd: rnio.params.string }, ({ pwd }, client) => {
    if (pwd !== process.env.PEER_PWD) return [403, 'denied'];
    client.linkAsPeer({
        shadowOut: ['cmd_broadcast.*'],
        shadowIn:  ['WT1.*'],
    });
    client.grantPerm('pitch.*', 'pitch.read');  // peer connection cap
    return { ok: true };
});
```

### 3. Declare the relay route on the caller side

```js
// central server
router.proxy('/turbine/:turbineID', {
    target:      (p) => rnio.inter(`turbine-${p.turbineID}`),
    permissions: ['turbine.:turbineID'],
});
```

That single declaration is everything central needs to know. Nothing
turbine-specific lives on central — adding a new turbine is a config change.

### 4. Write the route as you normally would, on turbine

```js
// turbine server
router.get('/pitch/status', () => ({ rpm: latestRpm, units: getUnits() }));

router.ws('/pitch/subscribe', (_p, client) => {
    client.subscribe('pitch.events');
    return { ok: true };
});

setInterval(() => {
    rnio.subs('pitch.events').obj({ ts: Date.now(), rpm: latestRpm });
}, 100);
```

API clients hitting `central` see all three: GET works, the WS subscribe
enrolls them on `pitch.events` (locally on central, via back-prop), and the
periodic publish fans out via a single coalesced shadow frame per peer link.

## What happens behind the scenes

### Wire protocol

Caller → callee:

| Frame                                                                                | Meaning                                                       |
|--------------------------------------------------------------------------------------|---------------------------------------------------------------|
| `{ _proxyenv: { id, env: { path, params, … }, open?: { actor, perms, mode? } } }`    | Dispatch an envelope on the ProxyClient with this id. `open` mints a fresh ProxyClient. |
| `{ _proxyclose: { id, reason? } }`                                                   | Tear down the ProxyClient.                                    |

Callee → caller:

| Frame                                                                                | Meaning                                                       |
|--------------------------------------------------------------------------------------|---------------------------------------------------------------|
| `{ _proxyr: { id, kind, args, last? } }`                                             | Tagged direct reply. `kind` echoes the `Client` method to invoke on the original caller. |
| `{ _proxyrchan: { channel, kind, args } }`                                           | Coalesced channel fan-out. Receiver replays `subs(channel)[kind](...args)` locally. |
| `{ _proxyrsub: { id, channel, op } }`                                                | Sub state back-prop — the ProxyClient just subscribed/unsubscribed locally; mirror on the original caller. |

### Lifecycle

* HTTP caller arrives at `/turbine/WT1/pitch/status` → central mints a fresh
  proxy id, sends `_proxyenv` with `open: { mode: 'request' }` plus the
  envelope, and holds the HTTP response open.
* Turbine creates a ProxyClient, dispatches the envelope, handler returns
  `{rpm, units}`. ProxyClient.obj is invoked, which sends `_proxyr` back.
  Because mode is `request`, the ProxyClient auto-closes after the handler
  returns, fires `wsClose` lifecycle hooks, and is removed from the peer
  table.
* Central receives `_proxyr` → invokes `caller.obj({rpm, units})` on the
  original HttpClient → response is written and the connection closes.

WS callers reuse the same proxy id across all of their proxied calls on
the same peer (memoised in `caller._proxyIds`), so a single ProxyClient on
turbine accumulates state and subscriptions across the API client's whole
session. When the WS client disconnects, `Client.close()` walks the table
and emits one `_proxyclose` per peer.

### Coalesced channel fan-out

`subs('pitch.events').obj(payload)` on turbine iterates members. Each
ProxyClient member receives the call together with `(channel, publishId)`
trailing args. ProxyClient routes through the peer link's shadow buffer:
the `(channel, publishId)` tuple keys the buffer so multiple ProxyClients
on the same peer collapse to a single wire frame
`{_proxyrchan: {channel, kind, args}}`. On the central side, the receiving
peer link checks the channel against its `shadowIn` whitelist and replays
the call as `restnio.subs('pitch.events').obj(payload)` — fanning out to
every API client that locally subscribed (via the `_proxyrsub` back-prop
when their proxied `client.subscribe('pitch.events')` ran on turbine).

Manual iteration loops bypass coalescing on purpose:

```js
// coalesced — one wire frame per peer
rnio.subs('pitch.events').obj(frame);

// per-client tagged delivery — N wire frames for N ProxyClients
rnio.subs('pitch.events').forEach(c => c.obj(frame));
```

### Permissions

The actor on the proxy session is built from the caller's effective perms
(or preserved if the caller already has one — for multi-hop). On the callee
side, the ProxyClient constructor clamps `actor.perms` against the peer
link's connection cap (`client.linkAsPeer` / `client.grantPerm`), and the
result is the connection-level `permissions` set. Per-route permission
checks read it like any other client.

## Migration from the old `subBridge` API

The previous `client.subBridge({ in, out })` machinery has been removed.
Channel forwarding is now part of the same proxy machinery: declare
`shadowIn` / `shadowOut` patterns on the peer link instead of explicit
channel lists, and pub/sub will work end-to-end without any extra wiring
on either side.

```js
// before
peer.subBridge({ in: ['cmd_broadcast'], out: ['telem', 'event'] });

// after
rnio.interconnect('central', url, {
    shadowIn:  ['cmd_broadcast.*'],
    shadowOut: ['telem.*', 'event.*'],
});
```

Channel naming on the wire is no longer auto-prefixed (the old
`prefix: 'WT1'` option). If you want per-source namespacing, name the
channel that way in user code: `rnio.subs('WT1.telem').obj(...)`.

## Streaming responses

Both HTTP and WS callers receive frames as they arrive. A handler that
returns a value triggers a single tagged reply and closes the proxy
session. A handler that returns `Infinity` keeps the session open and
can call `client.obj(...)` (or `str` / `bin`) repeatedly. End the stream
explicitly with `client.close()` — that emits a terminal
`{_proxyr: { kind: 'close', last: true }}` so the calling side ends the
HTTP response, or for a WS caller drops the proxy session id while
leaving the underlying socket alone.

```js
// streaming HTTP — body is the concatenation of every str/bin/obj write
router.get('/big-export', (_p, client) => {
    for (const row of bigDataset) client.str(JSON.stringify(row) + '\n');
    client.close();
    return Infinity;
});
```

```js
// streaming WS — N reply frames, then drop the proxy session
router.ws('/tail', (_p, client) => {
    const id = setInterval(() => client.obj({ ts: Date.now() }), 100);
    client.state.tailTimer = id;
    return Infinity;
});
router.on('wsClose', (_p, client) => {
    if (client.state.tailTimer) clearInterval(client.state.tailTimer);
});
```

## Multi-hop chains

`router.proxy()` works recursively. An intermediate server that registers
both an inbound peer link AND an outbound peer link can declare:

```js
// park.js — middle hop
const park = new RestNio((router) => {
    router.on('wsConnect', (_p, client) => {
        client.linkAsPeer({ shadowOut: ['*.*'], shadowIn: ['*.*'] });
        // ...auth, perm grants...
    });
    router.proxy('/turbine/:turbineID', {
        target: () => park.inter('turbine'),
    });
});
park.interconnect('turbine', 'wss://turbine.local', {
    shadowOut: [], shadowIn: ['*.*'],
});
```

The reply path is automatic: each hop's `ProxyClient.obj(...)` forwards
upstream via its own peer; closes propagate via the `kind: 'close'`
sentinel until they reach the entry-point caller. Permission claims
intersect at every hop against that hop's connection cap.

For HTTP single-shot semantics, every intermediate ProxyClient is
opened in `mode: 'request'` so the chain tears down once the final
reply has flowed back. Persistent (WS) callers reuse the same chain of
ProxyClients across requests.

## Reconnect grace

Each `interconnect()` reconnect option block accepts `gracePeriodMs`
(default `10000`). When the transport drops and reconnect is enabled,
the InterClient holds pending proxy sessions and ProxyClients alive
during the grace window. Outgoing frames continue to enter `_sendBuffer`
so they flush across the new socket on reconnect.

* If the reconnect lands in time, the grace timer is cancelled and the
  buffered frames flush. Be aware that frames addressed to ProxyClients
  on the *callee* side may fail — the callee tears down its
  WebSocketClient (and the ProxyClients it owned) on transport close
  immediately. Subsequent requests from the caller mint fresh sessions
  with `open: { ... }` and re-establish state.
* If the grace expires (or `peer.close()` runs, or `interFail` fires),
  pending callers receive `502 'proxy peer disconnected'` and any
  ProxyClients minted on this side close.

`gracePeriodMs: 0` disables the grace and matches the pre-grace
behaviour (immediate teardown on transport drop).

## Caveats and limits

* **Callee-side state does not survive reconnect.** ProxyClients on the
  callee side close on transport drop. To make subscriptions persist
  across reconnects, the caller must re-issue them after `interOpen`
  fires (or via app-level reconnect logic on the api client).
* **Binary frame correlation is opaque.** Raw `wsBin` frames don't carry
  the `_proxy*` envelope; a peer that wants per-caller binary routing
  needs an explicit application-level handler.
* **`client.subscribe` inside a proxied handler must be a stable name.**
  Per-caller channels (e.g. `subs(`user-${actor.sub}`)`) work but
  require the channel name to be derivable on both sides.

## Glossary

* **Peer link** — a long-lived WebSocket connection between two RestNio
  servers, typically opened with `rnio.interconnect()`. Both sides
  promote the connection to a peer link (`linkAsPeer` on the inbound
  side; the `shadowOut` / `shadowIn` options on the outbound side).
* **ProxyClient** — the in-process representation, on the callee side, of
  a remote caller. Lives across requests for the same `(caller, peer)`
  pair, accumulates state and subscriptions, replies via the peer link.
* **Shadow frame** — a `{_proxyrchan: {channel, kind, args}}` envelope
  forwarded once per peer per publish, regardless of the number of
  ProxyClients on that peer subscribed to the channel.
* **Sub back-prop** — the `{_proxyrsub: {…}}` envelope that mirrors a
  callee-side `client.subscribe(...)` onto the original caller's local
  subscriptions, so subsequent shadow frames are routed to them.