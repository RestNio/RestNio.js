# Operational Notes

## Server options

| Option | Default | Description |
|--------|---------|-------------|
| `port` | `7070` | TCP port to listen on |
| `http.enabled` | `true` | Enable the HTTP server |
| `websocket.enabled` | `true` | Enable the WebSocket server |
| `websocket.timeout` | `30000` | WebSocket ping timeout in ms |
| `websocket.hardClose` | `false` | Immediately destroy the socket on `.close()` instead of WS handshake |

## Proxy and trusted IPs

When running behind a load balancer or reverse proxy (nginx, Caddy, AWS ALB, etc.), configure `proxy.trustedProxies` so `client.ip` reflects the real client address from `X-Forwarded-For`:

```js
const app = new RestNio(routerFn, {
  proxy: {
    trustedProxies: ['127.0.0.1', '10.0.0.0/8'],
    rejectUnknown: false  // set true to block unlisted proxies
  }
});
```

## Explicit port override

Pass a port to `app.bind()` at start time to override the constructor option:

```js
app.bind(8080);
```

## Production security checklist

- **Never hard-code `auth.secret`** — load it from an environment variable, e.g. `process.env.JWT_SECRET`.
- For RS256/ES256 key pairs, set `auth.secret: null` and supply `auth.privateKey` / `auth.publicKey` instead.
- Weigh `auth.cookietoken: true` vs `false` — cookies are automatically sent by browsers and may be undesirable in some APIs.
- Apply `rnio.ratelimit()` *before* auth routes to avoid amplifying the cost of token validation.
- Set `proxy.trustedProxies` to your load-balancer's CIDR; leave it empty in development.
- Route all traffic over TLS (SSL) in production; RestNio itself has no TLS configuration — terminate at the proxy level.

## Graceful behaviour

- RestNio does **not** cluster across CPU cores — use `cluster` or a process manager (PM2) externally.
- There is no built-in graceful-shutdown hook. Call `process.exit()` and let your orchestration restart the service.

---

*[← Progressive Starter](Starter) | [Testing & Coverage →](Testing)*
