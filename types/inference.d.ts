/**
 * Inference helpers used by the Router/Client overloads to derive precise
 * `params` types from the route path + the `params:` schema at compile time.
 *
 * The runtime is unchanged JS; these types only exist for IDE / tsc.
 */

// Client uses `export = Client`, so we have to import it via the
// `import('...')` type-only form to get the class.
type Client = import('./_generated/lib/client/Client');

// ============================================================================
// Path parameter inference
// ============================================================================

/**
 * Extracts named segments from a route string.
 * Supports both `:name` and `$name` syntaxes (restnio supports both).
 *
 * @example
 * type T = PathParams<'/dog/:name/feed'>;        // { name: string }
 * type T = PathParams<'/u/:userId/post/:postId'>; // { userId: string; postId: string }
 * type T = PathParams<'/$name/hi'>;               // { name: string }
 * type T = PathParams<'/'>;                       // {}
 */
export type PathParams<P extends string> =
    P extends `${infer _Pre}:${infer Param}/${infer Rest}`
        ? { [K in Param | keyof PathParams<`/${Rest}`>]: string }
    : P extends `${infer _Pre}:${infer Param}`
        ? { [K in Param]: string }
    : P extends `${infer _Pre}$${infer Param}/${infer Rest}`
        ? { [K in Param | keyof PathParams<`/${Rest}`>]: string }
    : P extends `${infer _Pre}$${infer Param}`
        ? { [K in Param]: string }
    : {};

// ============================================================================
// Body / query parameter schema inference
// ============================================================================

/**
 * Brand applied to built-in restnio param helpers (`rnio.params.string`,
 * `rnio.params.integer`, `rnio.params.email`, etc.) so that the inference layer
 * can read the runtime TS type they parse to. Library users can also tag their
 * own `ParamDef`s by widening with `as ParamDef & TypedAs<MyType>`.
 */
export interface TypedAs<T> {
    /** Phantom — never set at runtime, exists for type inference only. */
    readonly __infer?: T;
}

/**
 * A parameter definition shape that the inference layer recognizes.
 * Compatible with the loose runtime `ParamDef` from JSDoc — we just don't
 * narrow `default` here (it has many union-typed forms in the runtime).
 */
export interface InferableParamDef {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'object';
    /** Brand carried by built-in helpers; library reads this for inference. */
    readonly __infer?: unknown;
}

/** A schema is a record of InferableParamDef. */
export type ParamSchema = Record<string, InferableParamDef>;

/**
 * Maps a single ParamDef → the TS type the handler will receive.
 * Branded helpers win first; otherwise we fall back to `type:` mapping.
 */
export type TypeOfDef<D> =
    D extends { __infer?: infer T } ? (T extends undefined ? FromTypeTag<D> : T)
    : FromTypeTag<D>;

/** Maps the `type:` literal string field → its corresponding TS type. */
export type FromTypeTag<D> =
    D extends { type: 'string' }  ? string :
    D extends { type: 'number' }  ? number :
    D extends { type: 'boolean' } ? boolean :
    D extends { type: 'object' }  ? Record<string, unknown> :
    unknown;

/** Keys in S whose ParamDef is `{ required: true }`. */
export type RequiredKeys<S> = {
    [K in keyof S]: S[K] extends { required: true } ? K : never;
}[keyof S];

/** Keys in S whose ParamDef is `{ required: false }` or omitted. */
export type OptionalKeys<S> = Exclude<keyof S, RequiredKeys<S>>;

/**
 * Maps a full ParamSchema → the params object the handler receives.
 * Required keys come through as their TS type; optional keys are `T | undefined`.
 */
export type InferSchema<S> = S extends ParamSchema
    ? { [K in RequiredKeys<S>]:  TypeOfDef<S[K]> }
    & { [K in OptionalKeys<S>]?: TypeOfDef<S[K]> }
    : {};

// ============================================================================
// Combined params type for a handler
// ============================================================================

/** All params a handler receives: path params + schema-defined body/query params. */
export type HandlerParams<P extends string, S> = PathParams<P> & InferSchema<S>;

/**
 * Smart `RouteFunc` whose `params` arg is precisely typed from the route path
 * and the optional schema. Return type is what the handler returns (or `void`).
 */
export type SmartRouteFunc<P extends string, S, R = unknown> =
    (params: HandlerParams<P, S>, client: Client) => R | Promise<R>;

/** Smart RouteDef — schema flows into the handler's params. */
export interface SmartRouteDef<P extends string, S extends ParamSchema, R = unknown> {
    func: SmartRouteFunc<P, S, R>;
    params?: S;
    permissions?: readonly string[];
    isActive?: boolean;
}

/** Either a plain function or the full smart def. */
export type SmartRouteArg<P extends string, S extends ParamSchema, R = unknown> =
    | SmartRouteFunc<P, S, R>
    | SmartRouteDef<P, S, R>;
