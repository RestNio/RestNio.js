# Auth and Permissions (JWT)

Auth is **enabled by default** with a random secret. Configure it explicitly in production:

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

HTTP clients include it in the `token` request header:

```bash
curl -H "token: <jwt>" http://localhost:7070/dogs
```

WebSocket clients include it directly in each message envelope:

```json
{ "path": "/dogs", "token": "<jwt>", "params": {} }
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

*[← Params & Validation](Params) | [HTTP Behavior →](HTTP)*
