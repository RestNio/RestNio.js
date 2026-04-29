# RestNio.js

> A Node.js framework with one routing model for HTTP **and** WebSocket.

```bash
npm install restnio
```

## What it is

RestNio is a lightweight Node.js server framework where every route is **bimodal** by default — the same handler works for HTTP requests and WebSocket messages unless you explicitly opt for one or the other.

- **Bimodal routing** — HTTP and WebSocket share the same route definitions by default
- **Built-in validation** — param parsing, type coercion, formatting, and checks in one pass
- **JWT auth** — per-route permission lists with path-param substitution (`dogs.feed.:name`)
- **Plugins** — `rnio.serve()`, `rnio.cors()`, `rnio.ratelimit()` mount as route middleware
- **Connectors** — outbound `RestNio.request()`, `RestNio.http`, `RestNio.websocket` clients built in
- **TypeScript** — ships `.d.ts` declarations with path-param type inference

## Quick navigation

### Getting started

| Page | Summary |
|------|---------|
| [Quick Start](Quick-Start) | Smallest working server in 10 lines |
| [Routing](Routing) | Bimodal, HTTP-only, WS-only, path params, regex, nested routers |
| [Params & Validation](Params) | Type coercion, shorthand helpers, checks, formatters |

### HTTP

| Page | Summary |
|------|---------|
| [HTTP Behavior](HTTP) | Response types, cookies, manual control, headers |
| [Auth & Permissions](Auth) | JWT tokens, `token.grant()`, cookie auth, permission templates |

### WebSocket

| Page | Summary |
|------|---------|
| [WebSocket Basics](WebSocket) | Unified routing model, RPC pattern, push, subscriptions |
| [Binary Routing](Binary) | Named binary routes, upload pattern |
| [Codec Negotiation](Codecs) | JSON (default) and MessagePack |

### Server features

| Page | Summary |
|------|---------|
| [Plugins](Plugins) | Static files, CORS, rate limiting |
| [Default Routes](Default-Routes) | Override `404` / `403` / `500` / `wsConnect` / `wsBin` |
| [Outbound Connectors](Connectors) | HTTP and WebSocket outbound clients |
| [Interconnect (S2S)](Interconnect) | Persistent peer connections between RestNio servers |

### Reference

| Page | Summary |
|------|---------|
| [TypeScript](TypeScript) | Declaration files, path-param inference |
| [Progressive Starter](Starter) | Annotated full example to copy and extend |
| [Operational Notes](Operations) | Server options, proxy config, security checklist |
| [Testing & Coverage](Testing) | Test commands and coverage matrix |
