/**
 * RestNio public TypeScript entry point.
 *
 * Layered design:
 *  - `./_generated/` — auto-generated `.d.ts` files emitted from JSDoc by
 *    `npm run build:types`. Cover the bulk of the public surface (Client,
 *    HttpClient, WebSocketClient, options typedefs, plugins, codecs, ...).
 *  - This file — hand-authored. Re-shapes the `Router` class so its method
 *    signatures use the inference layer (path-param + schema → handler `params`)
 *    instead of the loose JSDoc-derived ones.
 *
 * Because TypeScript appends augmented overloads after the existing ones (and
 * picks the first matching overload), we cannot simply `declare module …
 * { interface Router { … } }` and expect the smart signatures to win. Instead
 * we re-declare `Router` with smart-only signatures here, and re-export the
 * RestNio constructor from the generated module with our smart `Router` swapped
 * into the `RouteBack` callback type.
 *
 * Inference helpers (PathParams, InferSchema, TypedAs, …) live in
 * `./inference.d.ts`; they are re-exported by name below.
 */

/// <reference path="./inference.d.ts" />

import type {
    ParamSchema,
    SmartRouteFunc,
    SmartRouteDef
} from './inference';

// ---------------------------------------------------------------------------
// Pull commonly-used shapes from the generated tree.
// ---------------------------------------------------------------------------
type Options         = import('./_generated/lib/util/Options').Options;
type Client          = import('./_generated/lib/client/Client');
type Params          = import('./_generated/lib/params/').Params;
type RouteDef        = import('./_generated/lib/routes/Route').RouteDef;
type RouteFunc       = import('./_generated/lib/routes/Route').RouteFunc;
type ParamDef        = import('./_generated/lib/routes/Route').ParamDef;

// ---------------------------------------------------------------------------
// Smart Router — hand-authored class with inference-friendly signatures for
// every routing method. Unhandled calls (non-literal path strings, complex
// shapes) fall through to the catch-all overload at the bottom of each method.
// ---------------------------------------------------------------------------

interface SmartMethod {
    <P extends string, S extends ParamSchema = {}>(
        path: P,
        routedef: SmartRouteFunc<P, S> | SmartRouteDef<P, S>
    ): void;
    /** Loose fallback for non-literal paths or hand-rolled defs. */
    (path: string, routedef: RouteFunc | RouteDef, params?: Record<string, ParamDef>, permissions?: string[], isActive?: boolean): void;
}

interface SmartWsBin {
    /** Named binary route. */
    <S extends ParamSchema = {}>(
        name: string,
        routedef: SmartRouteFunc<'', S> | SmartRouteDef<'', S>
    ): void;
    /** Default (unnamed) binary route. */
    <S extends ParamSchema = {}>(
        routedef: SmartRouteFunc<'', S> | SmartRouteDef<'', S>
    ): void;
}

declare class Router {
    constructor(rnio: RestNio, path?: string);

    rnio: RestNio;
    path: string;

    // Bimodal HTTP + WS helpers ------------------------------------------------
    get:     SmartMethod;
    post:    SmartMethod;
    put:     SmartMethod;
    patch:   SmartMethod;
    delete:  SmartMethod;
    head:    SmartMethod;
    options: SmartMethod;
    trace:   SmartMethod;
    all:     SmartMethod;

    // HTTP-only ----------------------------------------------------------------
    httpGet:     SmartMethod;
    httpPost:    SmartMethod;
    httpPut:     SmartMethod;
    httpPatch:   SmartMethod;
    httpDelete:  SmartMethod;
    httpHead:    SmartMethod;
    httpOptions: SmartMethod;
    httpTrace:   SmartMethod;
    httpAll:     SmartMethod;
    httpDef(method: string, path: string, routedef: RouteDef | RouteFunc, params?: Record<string, ParamDef>, permissions?: string[], isActive?: boolean): void;
    httpRedirect(path: string, location: string, code?: number, absolute?: boolean, methods?: string[]): void;
    httpPrefix(methods: string): string;

    // WS only ------------------------------------------------------------------
    ws:    SmartMethod;
    wsBin: SmartWsBin;
    wsRedirect(path: string, location: string, code?: number, absolute?: boolean): void;
    wsPrefix(): string;

    // Special ------------------------------------------------------------------
    redirect(path: string, location: string, code?: number, absolute?: boolean, methods?: string[]): void;
    use(path: string, router: RouteBack, redirect?: boolean): void;
    use(router: RouteBack, redirect?: boolean): void;
    on(fullpath: string, routedef: RouteDef | RouteFunc, params?: Record<string, ParamDef>, permissions?: string[], isActive?: boolean): void;
    def(method: string, path: string, routedef: RouteDef | RouteFunc, params?: Record<string, ParamDef>, permissions?: string[], isActive?: boolean): void;
    defFull(fullpath: string, route: import('./_generated/lib/routes/Route')): void;
    prefix(methods?: string): string;
}

declare namespace Router {
    const allHttpMethods: string[];
    const httpRegex: RegExp;
}

/** RouteBack — main router callback. Note: uses our smart Router. */
type RouteBack = (router: Router, rnio: RestNio) => unknown;

// ---------------------------------------------------------------------------
// RestNio class — re-declared so the constructor's `routeFn` arg is typed
// with our smart Router, not the loose generated one.
// ---------------------------------------------------------------------------

declare class RestNio {
    constructor(routeFn: RouteBack, options?: Options);

    version: string;
    /** Built-in param helpers (string, integer, email, regexString, …). */
    params: Params;
    $p: Params;
    options: Options;
    router: Router;
    routes: import('./_generated/lib/util/RouteMap');
    subscriptions: import('./_generated/lib/util/SubscriptionMap');
    token?: import('./_generated/lib/authentication/Token');
    httpServer: import('http').Server;
    wsServer?: import('ws').Server;

    serve:     import('./_generated/lib/plugins/serve').Serve;
    cors:      import('./_generated/lib/plugins/cors').Cors;
    ratelimit: import('./_generated/lib/plugins/ratelimit').RateLimit;
    http:      typeof import('./_generated/lib/connector/httpConnector');
    request:   (typeof import('./_generated/lib/connector/httpConnector'))['singleHttp'];
    websocket: typeof import('./_generated/lib/connector/wsConnector');

    /**
     * Gets the clientset belonging to a certain subscription set name.
     */
    subs(name: string): import('./_generated/lib/util/ClientSet');

    /** Starts the server and binds to a port. */
    bind(port?: number): void;
}

declare namespace RestNio {
    // Static accessors mirror the runtime exposure in lib/RestNio.js.
    const params:    Params;
    const $p:        Params;
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

    // Common runtime classes / typedefs from the generated tree.
    export {
        Router,
        Client,
        Options,
        ParamDef,
        RouteDef,
        RouteFunc,
        RouteBack
    };
}

export = RestNio;
