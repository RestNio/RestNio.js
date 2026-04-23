# Auth and Permissions (JWT)

Authentication and fine-grained permissions are baked into RestNio from day one — not bolted on as an afterthought. The built-in JWT auth system gives you a complete identity layer that works identically over HTTP and WebSocket with almost no configuration.

## Why use it?

- **Zero boilerplate** — auth is enabled by default with a random secret; just call `rnio.token.grant()` to start issuing tokens
- **Unified transport** — the same token works for HTTP header auth, WebSocket envelopes, and browser cookie auth automatically
- **Declarative permissions** — attach a `permissions` array to any route; RestNio checks it before your handler runs
- **Template variables in permissions** — permission strings can reference URL path params (`:name`) so a single permission like `dogs.feed.:name` scopes exactly to the resource being accessed

## A typical authentication flow

```
Browser / Client
    │
    ├── POST /login  →  server validates credentials, returns rnio.token.grant(['...'])
    │                   ↳ token is a signed JWT string
    │
    ├── GET /me  (Authorization: token <jwt>)  →  server verifies, calls handler
    │
    └── ws connect → { path: '/data', token: '<jwt>', params: {} }
```

For **browser apps** with cookie-based auth: issue the token and write it into a `token` cookie once on login. Every subsequent request — HTTP *and* the WebSocket upgrade — will automatically carry the token without any client-side code change.

## Basic example

```js
const app = new RestNio((router, rnio) => {

  // Issue a token with a list of permissions
  router.get('/token', () => rnio.token.grant(['dogs.read', 'dogs.feed.fido']));

  // Verify a token manually
  router.post('/verify', {
    params: { token: rnio.params.string },
    func:   (params) => rnio.token.verify(params.token)
  });

  // Require a permission to access this route
  router.get('/dogs', {
    permissions: ['dogs.read'],
    func: () => ({ dogs: ['fido', 'rex'] })
  });

  // Permission template — :name is substituted from the matched path param
  router.post('/dogs/feed/:name', {
    permissions: ['dogs.feed.:name'],
    func: (params) => ({ fed: params.name })
  });

}, {
  auth: {
    enabled:     true,
    type:        'jwt',
    algorithm:   'HS256',
    secret:      'change-me-in-production',
    sign:        { expiresIn: '1h', issuer: 'RestNio' },
    verify:      { issuer: ['RestNio'] },
    cookietoken: true  // also accept a token from a cookie named 'token'
  }
});
```

## Sending a token

**HTTP header** (REST clients, curl, mobile apps):

```bash
curl -H "token: <jwt>" http://localhost:7070/dogs
```

**WebSocket envelope** (WS clients include it in each message):

```json
{ "path": "/dogs", "token": "<jwt>", "params": {} }
```

**HTTP cookie** (browsers — no JS needed after login):

When `cookietoken: true` (the default), RestNio automatically reads a cookie named `token` on every HTTP request. This makes browser session management trivial:

```js
// On login: set the cookie
router.post('/login', async (params, client) => {
  // ... validate credentials ...
  const jwt = await rnio.token.grant(['user.read', 'user.write']);
  client.cookie('token', jwt, { httpOnly: true, sameSite: 'Strict', maxAge: '1h' });
  return { ok: true };
});

// Protected route — no extra code needed; cookie is verified automatically
router.get('/me', {
  permissions: ['user.read'],
  func: (params, client) => ({ loggedIn: true })
});

// On logout: clear the cookie
router.post('/logout', (params, client) => {
  client.clearCookie('token');
  return { ok: true };
});
```

> **Security note**: Use `httpOnly: true` so the cookie is inaccessible to JavaScript. Consider `secure: true` in production (HTTPS only) and `sameSite: 'Strict'` to reduce CSRF risk.

## Permission system in depth

Permissions are free-form strings — you can model them however fits your domain. A token is granted an array of permission strings at issue time; a route declares the permissions needed to call it.

**Multiple permissions on a route** — a client needs *all* of them:

```js
router.post('/admin/reset', {
  permissions: ['admin', 'users.write'],
  func: () => ({ reset: true })
});
```

**Hierarchical naming** — a common convention is `resource.action` or `resource.action.scope`. You can invent any scheme; RestNio just does exact-string matching (plus template substitution):

```js
// Fine-grained RBAC example
const adminToken  = await rnio.token.grant(['admin', 'users.read', 'users.write', 'dogs.read', 'dogs.write']);
const dogGroomer  = await rnio.token.grant(['dogs.read', 'dogs.feed.rex', 'dogs.feed.fido']);
const readOnly    = await rnio.token.grant(['dogs.read', 'users.read']);
```

**Template variables** — `:param` in a permission string is replaced with the actual URL path segment when the request arrives. This lets one permission entry cover an entire family of scoped resources:

```js
router.post('/dogs/feed/:name', {
  permissions: ['dogs.feed.:name'],
  func: (params) => ({ fed: params.name })
});
// Token with 'dogs.feed.fido' → passes for /dogs/feed/fido
// Token with 'dogs.feed.fido' → 403 for /dogs/feed/rex
```

## Token API

```js
rnio.token.grant(permissions[])  // → Promise<string>  signs a JWT with the given perms
rnio.token.sign(payload, opts)   // → Promise<string>  raw sign with custom payload
rnio.token.verify(token)         // → Promise<object>  verifies and decodes a JWT
```

## Auth option summary

| Option | Default | Description |
|--------|---------|-------------|
| `auth.enabled` | `true` | Enable/disable auth system |
| `auth.type` | `'jwt'` | Auth type (currently only `jwt`) |
| `auth.algorithm` | `'HS256'` | JWT algorithm |
| `auth.secret` | random UUID | Shared secret (symmetric). Set to `null` when using key pairs |
| `auth.privateKey` | `null` | Private key for asymmetric signing |
| `auth.publicKey` | `null` | Public key for asymmetric verification |
| `auth.sign.expiresIn` | `'1h'` | Token lifetime (zeit/ms string or seconds) |
| `auth.sign.issuer` | `'RestNio'` | Issuer claim embedded in the token |
| `auth.verify.issuer` | `['RestNio']` | Accepted issuers on verification |
| `auth.cookietoken` | `true` | Auto-verify token from a cookie named `token` |

## Permission templates

The permissions array on a route can contain path-param placeholders:

```js
router.post('/dogs/feed/:name', {
  permissions: ['dogs.feed.:name'],
  func: (params) => ({ fed: params.name })
});
```

At check time RestNio substitutes `:name` with the actual value matched from the URL. A token granting `dogs.feed.fido` passes for `/dogs/feed/fido` but fails for `/dogs/feed/rex`.

---

*[← HTTP Behavior](HTTP) | [WebSocket Basics →](WebSocket)*
