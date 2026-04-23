# JavaScript and TypeScript Usage

## JavaScript

Works out of the box — no build step. JSDoc annotations throughout the source give full VS Code IntelliSense in plain `.js` files:

```js
const RestNio = require('restnio');
```

## TypeScript

The package ships pre-built declarations declared in `package.json` at `"types": "./types/index.d.ts"`. Path-param types are inferred from route strings at compile time.

```ts
import RestNio from 'restnio';

const app = new RestNio((router, rnio) => {

  // params.name is inferred as string from the :name path segment
  router.get('/dog/:name', (params) => {
    return { dog: params.name };
  });

  // params.age is inferred as number from the schema type literal
  router.post('/register', {
    params: {
      age: { required: true, type: 'number' as const }
    },
    func: (params) => {
      const age: number = params.age;
      return { ok: true, age };
    }
  });

  // Path params + schema params combine in the handler signature
  router.post('/dog/:name/feed', {
    params: {
      portion: { required: true, type: 'number' as const }
    },
    func: (params) => {
      const name: string = params.name;    // from :name
      const amt:  number = params.portion; // from schema
      return { fed: name, amount: amt };
    }
  });

}, { port: 7070 });
```

## Type declaration files

| File | Description |
|------|-------------|
| `types/index.d.ts` | Main entry point, re-exports everything. Hand-authored. |
| `types/inference.d.ts` | `PathParams`, `InferSchema`, `HandlerParams`, `SmartRouteFunc`, `SmartRouteDef`, `TypedAs` |
| `types/_generated/` | Auto-emitted from JSDoc via `tsc` |

## Build and validate

```bash
npm run build:types   # regenerate types/_generated/ from JSDoc
npm run test:types    # compile test/types/ — fails on any type error
```

`build:types` runs automatically on `npm pack`.

---

*[← Outbound Connectors](Connectors) | [Progressive Starter →](Starter)*
