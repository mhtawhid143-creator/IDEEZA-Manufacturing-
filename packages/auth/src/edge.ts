/**
 * The part of authentication that is safe on the edge.
 *
 * Middleware runs in a runtime with no `node:crypto` and no database, so it
 * cannot hash a token or read a session — and importing the whole package to get
 * a cookie name pulls the password hasher into that bundle, which fails the
 * build. Everything here is pure: a name, and the route table lookups.
 *
 * Keeping the surface this narrow is also the honest boundary: the middleware is
 * allowed to know *whether a path exists* and *whether a cookie is present*, and
 * nothing else. The permission decision belongs to the server layout.
 */
export { SESSION_COOKIE_NAME } from './config.js';
export {
  ROUTE_RULES,
  SURFACE_ROLE,
  isRouteAllowed,
  resolveRouteRule,
  type AppSurface,
  type RouteRule,
} from './route-rules.js';
