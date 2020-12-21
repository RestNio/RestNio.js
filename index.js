/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

module.exports = require('./lib/RestNio');

/**
 * Re-expose typedefs for silly IDE's.
 * @typedef {import("./lib/RestNio")} RestNio
 * @typedef {import("./lib/routes/Router").RouteBack} RouteBack
 * @typedef {import("./lib/routes/Route")} Route
 * @typedef {import("./lib/routes/Route").RouteFunc} RouteFunc
 * @typedef {import("./lib/routes/Route").RouteDef} RouteDef
 * @typedef {import("./lib/routes/Route").ParamDef} ParamDef
 * @typedef {import("./lib/client/Client")} Client
 * @typedef {import("./lib/authentication/Token")} Token
 * @typedef {import("./lib/params/").Params} Params
 * @typedef {import("./lib/params/formatters").Formatters} Formatters
 * @typedef {import("./lib/params/formatters/Num").NumFormat} NumFormat
 * @typedef {import("./lib/params/formatters/Str").StrFormat} StrFormat
 * @typedef {import("./lib/params/checks").Checks} Checks
 * @typedef {import("./lib/params/checks/Num").NumCheck} NumCheck
 * @typedef {import("./lib/params/checks/Str").StrCheck} StrCheck
 * @typedef {import("./lib/util/PermissionSet")} PermissionSet
 * @typedef {import("./lib/util/RouteMap")} RouteMap
 * @typedef {import("./lib/util/ClientSet")} ClientSet
 * @typedef {import("./lib/util/SubscriptionMap")} SubscriptionMap
 * @typedef {import("./lib/util/Options").Options} Options
 * @typedef {import("./lib/util/Options").AuthOptions} AuthOptions
 * @typedef {import("./lib/util/Options").AuthSignOptions} AuthSignOptions
 * @typedef {import("./lib/util/Options").AuthVerifyOptions} AuthVerifyOptions
 * @typedef {import("./lib/util/Options").ClientProperties} ClientProperties
 * @typedef {import("./lib/util/Options").CookieOptions} CookieOptions
 * @typedef {import("./lib/util/Options").ProxyOptions} ProxyOptions
 * @typedef {import("./lib/util/Options").getIpHeaderCallback} getIpHeaderCallback
 * @typedef {import("./lib/util/Options").getIpNetworkCallback} getIpNetworkCallback
 * @typedef {import("./lib/util/Options").DefaultOptions} DefaultOptions
 * @typedef {import("./lib/util/Options").HttpOptions} HttpOptions
 * @typedef {import("./lib/util/Options").WebsocketOptions} WebsocketOptions
 * @typedef {import("./lib/connector/httpConnector").httpCallback} httpCallback
 * @typedef {import("./lib/connector/httpConnector").httpClientRequest} httpClientRequest
 * @typedef {import("./lib/connector/httpConnector")} httpConnector
 * @typedef {import("./lib/connector/wsConnector").wsCallback} wsCallback
 * @typedef {import("./lib/connector/wsConnector")} wsConnector
 * @typedef {import("./lib/plugins/cors").Cors} Cors
 * @typedef {import("./lib/plugins/cors").CorsOptions} CorsOptions
 * @typedef {import("./lib/plugins/serve").Serve} Serve
 * @typedef {import("./lib/plugins/serve").ServeListing} ServeListing
 * @typedef {import("./lib/plugins/serve").ServeOptions} ServeOptions
 * @typedef {import("./lib/plugins/ratelimit").RateLimit} RateLimit
 * @typedef {import("./lib/plugins/ratelimit").RateLimitOptions} RateLimitOptions
 */