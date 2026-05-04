/**
 * RestNio public TypeScript entry point.
 *
 * Layered design:
 *  - `./_generated/` — auto-generated `.d.ts` files emitted from JSDoc by
 *    `npm run build:types`. Cover the bulk of the public surface (Client,
 *    HttpClient, WebSocketClient, options typedefs, plugins, codecs, ...).
 *  - This file — hand-authored. Re-shapes the `Router` class so its method
 *    signatures use the inference layer (path-param + schema → handler `params`)
 *    instead of the loose JSDoc-derived ones. Also brands the built-in
 *    `rnio.params.*` helpers with the TS types they parse to.
 *
 * Inference helpers (PathParams, InferSchema, TypedAs, …) live in
 * `./inference.d.ts`; they are re-exported as `RestNio.PathParams` etc.
 */

/// <reference path="./inference.d.ts" />

import type {
    ParamSchema,
    SmartRouteFunc,
    SmartRouteDef,
    TypedAs,
    InferableParamDef,
    HandlerParams
} from './inference';

// ---------------------------------------------------------------------------
// Shapes pulled from the generated tree (classes, option typedefs, plugins).
// ---------------------------------------------------------------------------
type Options          = import('./_generated/lib/util/Options').Options;
type Client           = import('./_generated/lib/client/Client');
type HttpClient       = import('./_generated/lib/client/HttpClient');
type WebSocketClient  = import('./_generated/lib/client/WebSocketClient');
type RouteDef         = import('./_generated/lib/routes/Route').RouteDef;
type RouteFunc        = import('./_generated/lib/routes/Route').RouteFunc;
type ParamDef         = import('./_generated/lib/routes/Route').ParamDef;
type Formatters       = import('./_generated/lib/params/formatters').Formatters;
type Checks           = import('./_generated/lib/params/checks').Checks;

// ---------------------------------------------------------------------------
// Branded Params — the built-in helpers re-typed with TypedAs<T> phantoms so
// schema entries using them infer the right TS type automatically (no more
// `as const` needed on `type:` literals).
// ---------------------------------------------------------------------------
interface BrandedParams {
    /** Formatter helpers (`$f`) — raw/untyped, see lib/params/formatters. */
    $f: Formatters;
    formatters: Formatters;
    /** Check helpers (`$c`) — raw/untyped, see lib/params/checks. */
    $c: Checks;
    checks: Checks;

    /** Required param of any type. Handler sees `unknown`. */
    required:     InferableParamDef & TypedAs<unknown>  & { required: true };
    /** Required param cast to string. */
    string:       InferableParamDef & TypedAs<string>   & { required: true; type: 'string' };
    /** Required param forced to string via String(). */
    forcedString: InferableParamDef & TypedAs<string>   & { required: true };
    /** Required param forced to string[] (supports CSV strings). */
    forcedArr:    InferableParamDef & TypedAs<string[]> & { required: true };
    /** Required param of type number. */
    number:       InferableParamDef & TypedAs<number>   & { required: true; type: 'number' };
    /** Required integer (number, with isInteger check). */
    integer:      InferableParamDef & TypedAs<number>   & { required: true; type: 'number' };
    /** Required boolean. */
    boolean:      InferableParamDef & TypedAs<boolean>  & { required: true; type: 'boolean' };
    /** Required email-formatted string. */
    email:        InferableParamDef & TypedAs<string>   & { required: true; type: 'string' };
    /** Required MAC-address-formatted string. */
    mac:          InferableParamDef & TypedAs<string>   & { required: true; type: 'string' };
    /** Required date (parsed from string or ms-since-epoch into a `Date`). */
    date:         InferableParamDef & TypedAs<Date>     & { required: true };
    /** Required UUID-formatted string. */
    uuid:         InferableParamDef & TypedAs<string>   & { required: true; type: 'string' };
    /** Required relative time in ms (`555` or `'1s'` → number). */
    relativeTime: InferableParamDef & TypedAs<number>   & { required: true };
    /** Optional relative date — defaults to `new Date()`. */
    relativeDate: InferableParamDef & TypedAs<Date>     & { required: false };
    /** Required time string (`hh:mm(:ss)`) parsed into a `Date`. */
    time:         InferableParamDef & TypedAs<Date>     & { required: true; type: 'string' };

    /**
     * Constrains a string param to one of the supplied options.
     * Handler type is the union of the options.
     *
     *     params: { color: rnio.params.enum('red', 'green', 'blue') }
     *     // → params.color is `'red' | 'green' | 'blue'`
     */
    enum<const O extends readonly string[]>(
        ...options: O
    ): InferableParamDef & TypedAs<O[number]> & { required: true };

    /**
     * Constrains a string param by a regex pattern.
     *
     *     params: { slug: rnio.params.regexString(/^[a-z-]+$/) }
     */
    regexString(
        regex: RegExp | string,
        valuetype?: string
    ): InferableParamDef & TypedAs<string> & { required: true; type: 'string' };
}

// ---------------------------------------------------------------------------
// Handler shapes — tuned per transport so `client` is the right subclass.
// ---------------------------------------------------------------------------

/** Bimodal HTTP+WS handler: `client` is the common base type. */
interface SmartMethod {
    <P extends string, S extends ParamSchema = {}>(
        path: P,
        routedef: SmartRouteFunc<P, S> | SmartRouteDef<P, S>
    ): void;
    /** Loose fallback for non-literal paths or hand-rolled defs. */
    (path: string, routedef: RouteFunc | RouteDef, params?: Record<string, ParamDef>, permissions?: string[], isActive?: boolean): void;
}

/** HTTP-only handler — `client` narrows to {@link HttpClient}. */
interface SmartHttpMethod {
    <P extends string, S extends ParamSchema = {}>(
        path: P,
        routedef:
            | ((params: HandlerParams<P, S>, client: HttpClient) => unknown)
            | {
                func: (params: HandlerParams<P, S>, client: HttpClient) => unknown;
                params?: S;
                permissions?: readonly string[];
                isActive?: boolean;
            }
    ): void;
    (path: string, routedef: RouteFunc | RouteDef, params?: Record<string, ParamDef>, permissions?: string[], isActive?: boolean): void;
}

/** WS-only handler — `client` narrows to {@link WebSocketClient}. */
interface SmartWsMethod {
    <P extends string, S extends ParamSchema = {}>(
        path: P,
        routedef:
            | ((params: HandlerParams<P, S>, client: WebSocketClient) => unknown)
            | {
                func: (params: HandlerParams<P, S>, client: WebSocketClient) => unknown;
                params?: S;
                permissions?: readonly string[];
                isActive?: boolean;
            }
    ): void;
    (path: string, routedef: RouteFunc | RouteDef, params?: Record<string, ParamDef>, permissions?: string[], isActive?: boolean): void;
}

/** Params a `wsBin` handler sees: raw frame payload + its byte length. */
interface WsBinParams {
    /** The raw binary frame payload as a Buffer. */
    data: Buffer;
    /** Byte length of `data`. */
    size: number;
}

type WsBinRouteFunc = (params: WsBinParams, client: WebSocketClient) => unknown;
interface WsBinRouteDef {
    func: WsBinRouteFunc;
    permissions?: readonly string[];
    isActive?: boolean;
}

/** `router.wsBin` — two forms: named (`'file'`) and default-unnamed. */
interface SmartWsBin {
    (name: string, routedef: WsBinRouteFunc | WsBinRouteDef): void;
    (routedef: WsBinRouteFunc | WsBinRouteDef): void;
}

/** Anything with `.obj()` accepts forwarded envelopes (Client or ClientSet). */
interface ProxyTarget {
    obj(envelope: unknown): unknown;
}

/** `router.proxy(prefix, opts)` — catch-all relay forwarder. */
interface ProxyOptions {
    /** The upstream — Client / ClientSet, or a function resolving one. */
    target: ProxyTarget | ((params: Record<string, unknown>, client: Client) => ProxyTarget | null | undefined);
    /** Permission requirements at this hop. Standard route-perm syntax. */
    permissions?: readonly string[];
    /** HTTP methods to register for. Defaults to all. WS always registered. */
    methods?: readonly string[];
}

/** Subscription-bridge config — see `client.subBridge`. */
interface SubBridgeOptions {
    /** Local channel names whose frames flow OUT to the peer. `'*'` = all. */
    out?: readonly string[] | '*';
    /** Inbound `sub.frame` channels to re-publish locally. `'*'` = all. */
    in?:  readonly string[] | '*';
    /** Prefix applied to OUT channel names (`local` → `<prefix>.<local>`). */
    prefix?: string;
    /** Reserved for future ref-count-driven subscribe/unsubscribe. v1: ignored. */
    onDemand?: boolean;
}

/** Live `SubBridge` instance returned by `client.subBridge(opts)`. */
interface SubBridge {
    /** Detach the bridge — unsubscribes all virtual proxies. */
    teardown(): void;
}

// ---------------------------------------------------------------------------
// Smart Router — hand-authored so smart signatures win over the loose ones.
// ---------------------------------------------------------------------------

declare class Router {
    constructor(rnio: RestNio, path?: string);

    rnio: RestNio;
    path: string;

    // Bimodal (HTTP + WS) -----------------------------------------------------
    get:     SmartMethod;
    post:    SmartMethod;
    put:     SmartMethod;
    patch:   SmartMethod;
    delete:  SmartMethod;
    head:    SmartMethod;
    options: SmartMethod;
    trace:   SmartMethod;
    all:     SmartMethod;

    // HTTP-only ---------------------------------------------------------------
    httpGet:     SmartHttpMethod;
    httpPost:    SmartHttpMethod;
    httpPut:     SmartHttpMethod;
    httpPatch:   SmartHttpMethod;
    httpDelete:  SmartHttpMethod;
    httpHead:    SmartHttpMethod;
    httpOptions: SmartHttpMethod;
    httpTrace:   SmartHttpMethod;
    httpAll:     SmartHttpMethod;
    httpDef(method: string, path: string, routedef: RouteDef | RouteFunc, params?: Record<string, ParamDef>, permissions?: string[], isActive?: boolean): void;
    httpRedirect(path: string, location: string, code?: number, absolute?: boolean, methods?: string[]): void;
    httpPrefix(methods: string): string;

    // WS-only -----------------------------------------------------------------
    ws:    SmartWsMethod;
    wsBin: SmartWsBin;
    wsRedirect(path: string, location: string, code?: number, absolute?: boolean): void;
    wsPrefix(): string;

    // Special -----------------------------------------------------------------
    redirect(path: string, location: string, code?: number, absolute?: boolean, methods?: string[]): void;
    use(path: string, router: RouteBack, redirect?: boolean): void;
    use(router: RouteBack, redirect?: boolean): void;
    on(fullpath: string, routedef: RouteDef | RouteFunc, params?: Record<string, ParamDef>, permissions?: string[], isActive?: boolean): void;
    def(method: string, path: string, routedef: RouteDef | RouteFunc, params?: Record<string, ParamDef>, permissions?: string[], isActive?: boolean): void;
    defFull(fullpath: string, route: import('./_generated/lib/routes/Route')): void;
    prefix(methods?: string): string;

    /**
     * Catch-all relay: forwards every request under `prefix` (HTTP + WS) to a
     * target Client / ClientSet / function-resolved upstream. Internally
     * registers on `${prefix}/:rest*`. Captures the post-prefix path as
     * `params.rest`, mints a fresh `_actor` from the calling client (or
     * preserves an inbound one), and pushes via `target.obj(...)`. Returns
     * 503 when the target is missing.
     */
    proxy(prefix: string, opts: ProxyOptions): void;
}

declare namespace Router {
    const allHttpMethods: string[];
    const httpRegex: RegExp;
}

/** Main router callback. Uses our smart Router, not the loose generated one. */
type RouteBack = (router: Router, rnio: RestNio) => unknown;

// ---------------------------------------------------------------------------
// RestNio class — re-declared so the constructor's `routeFn` arg is typed
// with our smart Router, and `params` is the branded helpers.
// ---------------------------------------------------------------------------

declare class RestNio {
    constructor(routeFn: RouteBack, options?: Options);

    version: string;
    /**
     * Built-in param helpers (`rnio.params.string`, `.integer`, `.email`,
     * `.enum('a','b')`, `.regexString(/…/)`, etc.). Each one is branded with
     * the TS type it ultimately resolves to, so schemas using them infer
     * handler `params` automatically without `as const`.
     */
    params: BrandedParams;
    $p: BrandedParams;
    options: Options;
    router: Router;
    routes: import('./_generated/lib/util/RouteMap');
    subscriptions: import('./_generated/lib/util/SubscriptionMap');
    /**
     * JWT token manager. Present whenever `options.auth.enabled` is `true` and
     * `options.auth.type === 'jwt'` (which is the default). Calling any
     * method on it while auth is disabled crashes at runtime.
     */
    token: import('./_generated/lib/authentication/Token');
    httpServer: import('http').Server;
    wsServer?: import('ws').Server;

    serve:     import('./_generated/lib/plugins/serve').Serve;
    cors:      import('./_generated/lib/plugins/cors').Cors;
    ratelimit: import('./_generated/lib/plugins/ratelimit').RateLimit;
    http:      typeof import('./_generated/lib/connector/httpConnector');
    request:   (typeof import('./_generated/lib/connector/httpConnector'))['singleHttp'];
    websocket: typeof import('./_generated/lib/connector/wsConnector');

    /** Gets the `ClientSet` belonging to a subscription name. */
    subs(name: string): import('./_generated/lib/util/ClientSet');

    /** Starts the server and binds to a port (defaults to `options.port`). */
    bind(port?: number): void;
}

declare namespace RestNio {
    // Static accessors mirror the runtime exposure in lib/RestNio.js.
    const params:    BrandedParams;
    const $p:        BrandedParams;
    const http:      typeof import('./_generated/lib/connector/httpConnector');
    const request:   (typeof import('./_generated/lib/connector/httpConnector'))['singleHttp'];
    const websocket: typeof import('./_generated/lib/connector/wsConnector');
    const serve:     import('./_generated/lib/plugins/serve').Serve;
    const cors:      import('./_generated/lib/plugins/cors').Cors;
    const ratelimit: import('./_generated/lib/plugins/ratelimit').RateLimit;
    const codecs:    typeof import('./_generated/lib/codec');

    // Inference helpers — re-exported as nested types for ergonomics.
    type PathParams<P extends string>    = import('./inference').PathParams<P>;
    type InferSchema<S>                  = import('./inference').InferSchema<S>;
    type HandlerParams<P extends string, S> = import('./inference').HandlerParams<P, S>;
    type SmartRouteFunc<P extends string, S, R = unknown> = import('./inference').SmartRouteFunc<P, S, R>;
    type SmartRouteDef<P extends string, S extends import('./inference').ParamSchema, R = unknown> = import('./inference').SmartRouteDef<P, S, R>;
    type TypedAs<T>                      = import('./inference').TypedAs<T>;
    type ParamSchema                     = import('./inference').ParamSchema;
    type InferableParamDef               = import('./inference').InferableParamDef;
    type WsBinParams                     = import('./index').WsBinParams;

    // Common runtime classes / typedefs from the generated tree.
    export {
        Router,
        Client,
        HttpClient,
        WebSocketClient,
        Options,
        ParamDef,
        RouteDef,
        RouteFunc,
        RouteBack,
        BrandedParams as Params
    };
}

export = RestNio;

// Export WsBinParams at module scope so the `namespace` re-export above
// (`import('./index').WsBinParams`) resolves.
export type { WsBinParams };
