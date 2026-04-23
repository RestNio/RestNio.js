/**
 * Verifies that the smart Router overloads infer params correctly.
 *
 * Each block uses direct assignments + `// @ts-expect-error` to fail compile
 * if the inference breaks. Running `npm run test:types` is the assertion.
 */
import RestNio from '../../';

new RestNio((router) => {

    // 1) Path param inference — single segment.
    router.get('/dog/:name', (params) => {
        const name: string = params.name; // OK: inferred from :name
        // @ts-expect-error  'nmae' is a typo, not a real key.
        const typo = params.nmae;
        return name;
    });

    // 2) Path param inference — multiple segments.
    router.get('/u/:userId/post/:postId', (params) => {
        const u: string = params.userId;
        const p: string = params.postId;
        // @ts-expect-error  unknown key.
        const x = params.foo;
        return `${u}/${p}`;
    });

    // 3) Inline schema with `as const` — `type:` literals drive inference.
    router.post('/claim', {
        params: {
            name: { required: true, type: 'string' as const },
            age:  { required: true, type: 'number' as const }
        },
        func: (params) => {
            const n: string = params.name;
            const a: number = params.age;
            // @ts-expect-error  number is not a string.
            const wrong: string = params.age;
            return { saved: n, age: a };
        }
    });

    // 4) Path params + body schema combine.
    router.post('/dog/:name/feed', {
        params: {
            portion: { required: true, type: 'number' as const }
        },
        func: (params) => {
            const n: string = params.name;     // from :name
            const p: number = params.portion;  // from schema
            return { fed: n, portion: p };
        }
    });

    // 5) Optional schema entry → `T | undefined`.
    router.post('/maybe', {
        params: {
            tag: { type: 'string' as const } // no required:true → optional
        },
        func: (params) => {
            // params.tag is `string | undefined` — must guard before using as string.
            const t: string = params.tag ?? 'default';
            // @ts-expect-error  using directly without coalesce should flag in strict mode.
            const direct: string = params.tag;
            return t;
        }
    });

    // 6) Plain handler form (no schema) — only path params.
    router.get('/who/:name', (params, client) => {
        const n: string = params.name;
        const ip: string | null = client.ip;
        client.state.requestId = 'abc'; // state is `Record<string, any>`
        return { hi: n, ip };
    });

    // 7) Bimodal `all` works the same way.
    router.all('/shared/:id', (params) => {
        const id: string = params.id;
        return { id };
    });

}, { port: 0, auth: { enabled: false } });
