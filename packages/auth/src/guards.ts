import {
  PermissionDeniedError,
  assertCan,
  can,
  type ActorRole,
  type Capability,
} from '@ideeza/domain';
import type { AuthenticatedActor } from './actor.js';
import { SESSION_COOKIE_NAME } from './config.js';
import { NoSessionError } from './errors.js';
import type { SessionService } from './session.js';

export interface HeaderBag {
  get(name: string): string | null;
}

export type RequestHeaders =
  | HeaderBag
  | Readonly<Record<string, string | readonly string[] | undefined>>;

export interface RequestLike {
  readonly headers: RequestHeaders;
  readonly url?: string | undefined;
  readonly method?: string | undefined;
}

const isHeaderBag = (headers: RequestHeaders): headers is HeaderBag =>
  typeof (headers as HeaderBag).get === 'function';

const firstValue = (
  value: string | readonly string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : (value as string | undefined));

/**
 * Header names are case insensitive on the wire. A Headers style bag handles
 * that itself; a plain object does not, so the lookup falls back to a case
 * insensitive scan.
 */
export const readHeader = (headers: RequestHeaders, name: string): string | undefined => {
  if (isHeaderBag(headers)) return headers.get(name) ?? undefined;

  const wanted = name.toLowerCase();
  const direct = firstValue(headers[name] ?? headers[wanted]);
  if (direct !== undefined) return direct;

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return firstValue(value);
  }
  return undefined;
};

export const parseCookies = (
  cookieHeader: string | undefined,
): Readonly<Record<string, string>> => {
  if (cookieHeader === undefined || cookieHeader === '') return {};
  const jar: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key !== '') jar[key] = decodeURIComponent(value);
  }
  return jar;
};

/**
 * Reads the session token from an Authorization header or the session cookie.
 * Nothing else is accepted: a token in a query string would end up in logs.
 */
export const readSessionToken = (request: RequestLike): string | undefined => {
  const authorization = readHeader(request.headers, 'authorization');
  if (authorization !== undefined) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    const token = match?.[1]?.trim();
    if (token !== undefined && token !== '') return token;
  }
  const cookies = parseCookies(readHeader(request.headers, 'cookie'));
  const fromCookie = cookies[SESSION_COOKIE_NAME];
  return fromCookie === '' ? undefined : fromCookie;
};

/** Resolves the actor for a request, or throws. */
export const authenticateRequest = async (
  request: RequestLike,
  sessionService: SessionService,
): Promise<AuthenticatedActor> => {
  const token = readSessionToken(request);
  if (token === undefined) throw new NoSessionError();
  return sessionService.resolveActor(token);
};

/** Delegates to the approved permission matrix; deny by default. */
export const requireCapability = (
  actor: AuthenticatedActor,
  capability: Capability,
): void => {
  assertCan(actor, capability);
};

export const requireAnyCapability = (
  actor: AuthenticatedActor,
  capabilities: readonly Capability[],
): void => {
  const permitted = capabilities.some((capability) => can(actor.role, capability));
  if (!permitted) {
    throw new PermissionDeniedError(capabilities.join('|'), actor.role);
  }
};

export const requireRole = (
  actor: AuthenticatedActor,
  roles: readonly ActorRole[],
): void => {
  if (!roles.includes(actor.role)) {
    throw new PermissionDeniedError(`role:${roles.join('|')}`, actor.role);
  }
};

/** Refuses an actor acting on another account's own data. */
export const requireSelf = (actor: AuthenticatedActor, userId: string): void => {
  if (actor.userId !== userId && actor.role !== 'ops_admin') {
    throw new PermissionDeniedError('self', actor.role, 'this belongs to another account');
  }
};

export interface GuardOptions {
  readonly capability?: Capability | undefined;
  readonly roles?: readonly ActorRole[] | undefined;
}

/**
 * One place to authenticate a request and apply the role and capability checks,
 * so a handler cannot forget one of the three steps.
 */
export const guardRequest = async (
  request: RequestLike,
  sessionService: SessionService,
  options: GuardOptions = {},
): Promise<AuthenticatedActor> => {
  const actor = await authenticateRequest(request, sessionService);
  if (options.roles !== undefined) requireRole(actor, options.roles);
  if (options.capability !== undefined) requireCapability(actor, options.capability);
  return actor;
};
