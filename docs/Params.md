# Params, Validation, and Formatting

RestNio's parameter system is the engine behind safe, self-documenting routes. Parameters arrive from three sources — URL path segments, query string, and request body — and RestNio merges them all into a single `params` object before your handler is called. By describing the expected parameters alongside the route, you get automatic validation and transformation without any boilerplate.

## Where params come from

**Path parameters** are extracted from the URL itself based on `:variable` placeholders in the route string. They land in `params` just like any other value:

```js
// GET /user/42  →  params.id === '42'
router.get('/user/:id', (params) => ({ id: params.id }));
```

**Query string and body params** (HTTP) or the `params` field of the WS envelope are merged on top. Query/body values take precedence over identically-named path params.

## Shorthand helpers — the fast path

For common cases, `rnio.params` provides ready-made param definitions you attach directly to the key:

```js
router.post('/register', {
  params: {
    username: rnio.params.string,       // required string
    age:      rnio.params.integer,      // required whole number
    email:    rnio.params.email,        // required, validated + lowercased
    role:     rnio.params.enum('user', 'admin', 'mod')
  },
  func: (params) => ({ ok: true, params })
});
```

Access them via `rnio.params` on the instance or `RestNio.params` statically:

| Helper | Type | Description |
|--------|------|-------------|
| `params.required` | any | Required, no type check |
| `params.string` | string | Required string |
| `params.forcedString` | string | Required, cast to string |
| `params.forcedArr` | array | Required, cast to array (splits comma-separated strings) |
| `params.number` | number | Required number |
| `params.integer` | integer | Required whole number |
| `params.boolean` | boolean | Required boolean |
| `params.email` | string | Required valid email (normalised to lowercase) |
| `params.mac` | string | Required MAC address |
| `params.date` | Date | Required, parsed from string or ms timestamp |
| `params.uuid` | string | Required RFC4122 UUID (braces stripped) |
| `params.time` | Date | Required `hh:mm[:ss]` string → today's Date |
| `params.relativeTime` | number | Required, zeit/ms string or number → milliseconds |
| `params.relativeDate` | Date | Optional (defaults to now), relative offset → absolute Date |
| `params.enum(...opts)` | string | Required, value must be one of the given options |
| `params.regexString(re, type)` | string | Required, value must match regex |

```js
router.post('/order', {
  params: {
    status:   rnio.params.enum('pending', 'shipped', 'delivered'),
    sku:      rnio.params.regexString(/^[A-Z]{3}-\d{4}$/, 'SKU'),
    quantity: rnio.params.integer,
    notes:    { default: '' }
  },
  func: (params) => ({ queued: params })
});
```

## Full object notation — complete control

When you need custom validation logic, transformations, or optional fields with defaults, use the full `ParamDef` object. A route definition object can contain:

| Field | Description |
|-------|-------------|
| `func` | Route handler `(params, client) => result` |
| `params` | Map of parameter names to `ParamDef` objects |
| `permissions` | Array of required permission strings |
| `isActive` | `false` for middleware-style routes that set headers but return nothing |

### ParamDef structure

```js
{
  required:           true,       // reject the request if the param is absent
  ignoreEmptyString:  true,       // treat '' as absent
  default:            'fallback', // default value, or a () => value function
  type:               'string',   // typeof check applied before formatters run
  prechecks:          [...],      // validators BEFORE formatters
  formatters:         [...],      // transformers applied in order
  checks:             [...]       // validators AFTER formatters
}
```

Processing order per parameter: **prechecks → formatters → checks**.

### Full example

```js
router.post('/users', {
  params: {
    name: {
      required: true,
      type: 'string',
      formatters: [rnio.params.formatters.str.toLowerCase()],
      checks: [
        rnio.params.checks.str.min(3),
        rnio.params.checks.str.max(40)
      ]
    },
    age: {
      required: true,
      type: 'number',
      checks: [
        rnio.params.checks.num.isInteger(),
        rnio.params.checks.num.min(0),
        rnio.params.checks.num.max(130)
      ]
    },
    role: { default: 'user' }
  },
  func: (params) => ({ created: true, params })
});
```

**Numeric** (`rnio.params.checks.num`):

| Check | Description |
|-------|-------------|
| `.isInteger()` | Must be a whole number |
| `.min(n)` | Must be `>= n` |
| `.max(n)` | Must be `<= n` |
| `.range(from, to)` | Must be `>= from` and `< to` |

**String** (`rnio.params.checks.str`):

| Check | Description |
|-------|-------------|
| `.email()` | Valid email format |
| `.uuid()` | Valid RFC4122 UUID |
| `.time()` | Valid `hh:mm[:ss]` string |
| `.mac()` | Valid MAC address |
| `.regex(pattern, type)` | Must match regex |
| `.min(n)` | Length `>= n` |
| `.max(n)` | Length `<= n` |
| `.range(from, to)` | Length `>= from` and `< to` |

## Built-in formatters

**Numeric** (`rnio.params.formatters.num`):

| Formatter | Description |
|-----------|-------------|
| `.add(n)` | Add n |
| `.subtract(n)` | Subtract n |
| `.multiply(factor)` | Multiply |
| `.devide(divisor)` | Divide |
| `.raise(exponent)` | Raise to a power |
| `.clamp(from, to)` | Clamp to range (inclusive) |
| `.toTime(long?)` | ms number → zeit/ms string (`60000` → `"1m"`) |

**String** (`rnio.params.formatters.str`):

| Formatter | Description |
|-----------|-------------|
| `.toStr()` | Cast to string |
| `.toLowerCase()` | Lowercase |
| `.toUpperCase()` | Uppercase |
| `.toObj()` | Parse JSON string → object |
| `.toMillis()` | zeit/ms string → number of milliseconds |
| `.toDate()` | Date string or ms number → `Date` object |
| `.toTime()` | `hh:mm[:ss]` string → today's `Date` |
| `.toUuid()` | Strip braces from UUID string |

---

*[← Routing](Routing) | [Auth →](Auth)*
