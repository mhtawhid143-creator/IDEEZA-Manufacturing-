import { can, type ActorRole, type Capability } from '@ideeza/domain';
import type { AuthenticatedActor } from './actor.js';
import { NoSessionError, RouteForbiddenError } from './errors.js';

/**
 * The three deployed surfaces. Keeping one table per surface is what makes a
 * cross-domain leak impossible to write by accident: a buyer path simply does
 * not exist in the manufacturer table.
 */
export type AppSurface = 'user' | 'manufacturer' | 'ops';

export const SURFACE_ROLE: Readonly<Record<AppSurface, ActorRole>> = Object.freeze({
  user: 'buyer',
  manufacturer: 'manufacturer',
  ops: 'ops_admin',
});

export interface RouteRule {
  /** Path pattern. `*` matches one segment, `**` matches the rest of the path. */
  readonly pattern: string;
  /** Capability required in addition to the surface role. */
  readonly capability?: Capability;
  /** Reachable without a session. */
  readonly anonymous?: boolean;
}

const SHARED_AUTH_ROUTES: readonly RouteRule[] = Object.freeze([
  { pattern: '/health', anonymous: true },
  { pattern: '/auth/sign-in', anonymous: true },
  { pattern: '/auth/sign-out', anonymous: true },
  { pattern: '/auth/session', anonymous: true },
  // The component gallery renders the design system with no data in it, so it
  // is readable without a session for design review.
  { pattern: '/design-system', anonymous: true },
  // Reachable without a session on purpose: they explain a refusal, and
  // requiring a session to read them would loop.
  { pattern: '/forbidden', anonymous: true },
  { pattern: '/unavailable', anonymous: true },
]);

const USER_RULES: readonly RouteRule[] = Object.freeze([
    ...SHARED_AUTH_ROUTES,
    // Review mode only: signing in without a password when the review
    // environment asks for it. The route itself answers 404 unless
    // REVIEW_DIRECT_SIGN_IN is set, so a rule here grants nothing on its own.
    { pattern: '/auth/enter', anonymous: true },
    { pattern: '/', capability: 'order.view' },
    { pattern: '/favorites', capability: 'product.favorite' },
    { pattern: '/products/*', capability: 'product.browse' },
    { pattern: '/manufacturing', capability: 'order.view' },
    { pattern: '/manufacturing/draft/**', capability: 'rfq.create' },
    { pattern: '/manufacturing/rfq', capability: 'rfq.view' },
    { pattern: '/manufacturing/rfq/new', capability: 'rfq.create' },
    { pattern: '/manufacturing/rfq/new/**', capability: 'rfq.create' },
    { pattern: '/manufacturing/rfq/*', capability: 'rfq.view' },
    { pattern: '/manufacturing/rfq/*/quotes', capability: 'quote.view' },
    { pattern: '/manufacturing/rfq/*/quotes/*', capability: 'quote.view' },
    { pattern: '/manufacturing/rfq/*/compare', capability: 'quote.view' },
    { pattern: '/manufacturing/rfq/*/accepted', capability: 'quote.view' },
    { pattern: '/manufacturing/rfq/*/activity', capability: 'rfq.view' },
    { pattern: '/manufacturing/rfq/*/substitutions', capability: 'substitution.decide' },
    { pattern: '/manufacturing/checkout/**', capability: 'checkout.pay' },
    { pattern: '/manufacturing/orders', capability: 'order.view' },
    { pattern: '/manufacturing/history', capability: 'order.view' },
    { pattern: '/manufacturing/orders/*', capability: 'order.view' },
    { pattern: '/manufacturing/orders/*/items', capability: 'order.view' },
    { pattern: '/manufacturing/orders/*/progress', capability: 'order.view' },
    { pattern: '/manufacturing/orders/*/records', capability: 'evidence.read' },
    { pattern: '/manufacturing/orders/*/confirm-delivery', capability: 'delivery.confirm' },
    { pattern: '/manufacturing/orders/*/refund', capability: 'refund.request' },
    { pattern: '/manufacturing/orders/*/cancel', capability: 'cancellation.request' },
    { pattern: '/manufacturing/orders/*/dispute', capability: 'dispute.open' },
    { pattern: '/manufacturing/orders/*/dispute/*', capability: 'dispute.open' },
    { pattern: '/messages', capability: 'messaging.participate' },
    { pattern: '/messages/**', capability: 'messaging.participate' },
    { pattern: '/notifications', capability: 'messaging.participate' },
]);

const MANUFACTURER_RULES: readonly RouteRule[] = Object.freeze([
    ...SHARED_AUTH_ROUTES,
    // Review mode only: signing in without a password when the review
    // environment asks for it. The route itself answers 404 unless
    // REVIEW_DIRECT_SIGN_IN is set, so a rule here grants nothing on its own.
    { pattern: '/auth/enter', anonymous: true },
    { pattern: '/', capability: 'rfq.view' },
    { pattern: '/dashboard', capability: 'rfq.view' },
    { pattern: '/rfqs', capability: 'rfq.view' },
    { pattern: '/rfqs/*', capability: 'rfq.view' },
    // The tabs of one request: reading a specification, the files or the bill of
    // materials is the same permission as reading the request itself.
    { pattern: '/rfqs/*/files', capability: 'rfq.view' },
    { pattern: '/rfqs/*/specification', capability: 'rfq.view' },
    { pattern: '/rfqs/*/bom', capability: 'rfq.view' },
    { pattern: '/rfqs/*/decline', capability: 'rfq.decline' },
    { pattern: '/rfqs/*/quote', capability: 'quote.create' },
    { pattern: '/rfqs/*/substitutions', capability: 'substitution.suggest' },
    { pattern: '/quotes', capability: 'quote.view' },
    { pattern: '/quotes/*', capability: 'quote.view' },
    // The tabs of one quote: the request it answers, the substitutes it
    // suggests, and what has happened to it. All reading, one permission.
    { pattern: '/quotes/*/rfq', capability: 'quote.view' },
    { pattern: '/quotes/*/substitutions', capability: 'quote.view' },
    { pattern: '/quotes/*/activity', capability: 'quote.view' },
    { pattern: '/quotes/*/revise', capability: 'quote.revise' },
    // Withdrawing is revising down to nothing: same authority over the same
    // quote, and there is no separate capability for it.
    { pattern: '/quotes/*/withdraw', capability: 'quote.revise' },
    { pattern: '/orders', capability: 'order.view' },
    { pattern: '/orders/*', capability: 'order.view' },
    // The tabs of one order: the terms it was opened against, the files and the
    // specification. All reading, and the same permission as the order itself.
    { pattern: '/orders/*/quote', capability: 'order.view' },
    { pattern: '/orders/*/files', capability: 'order.view' },
    { pattern: '/orders/*/specification', capability: 'order.view' },
    { pattern: '/orders/*/production', capability: 'production.update' },
    // Moving the line, recording what it produced, and saying a part is short.
    { pattern: '/orders/*/evidence', capability: 'production.update' },
    { pattern: '/orders/*/shipment', capability: 'production.update' },
    { pattern: '/orders/*/shortage', capability: 'inventory.write' },
    { pattern: '/orders/*/cancel-request', capability: 'cancellation.request' },
    { pattern: '/orders/*/refund-response', capability: 'refund.respond' },
    { pattern: '/orders/*/dispute', capability: 'dispute.open' },
    { pattern: '/orders/*/disputes/*', capability: 'dispute.open' },
    { pattern: '/messages', capability: 'messaging.participate' },
    { pattern: '/inventory', capability: 'inventory.read' },
    { pattern: '/inventory/**', capability: 'inventory.write' },
    { pattern: '/payouts', capability: 'payout.withdraw' },
    { pattern: '/payouts/**', capability: 'payout.withdraw' },
    { pattern: '/messages/**', capability: 'messaging.participate' },
    { pattern: '/notifications', capability: 'messaging.participate' },
    { pattern: '/profile', capability: 'profile.manage' },
    { pattern: '/profile/**', capability: 'profile.manage' },
    { pattern: '/blog', capability: 'blog.publish' },
    { pattern: '/blog/**', capability: 'blog.publish' },
    { pattern: '/settings', capability: 'settings.manage' },
    { pattern: '/settings/**', capability: 'settings.manage' },
]);

const OPS_RULES: readonly RouteRule[] = Object.freeze([
    ...SHARED_AUTH_ROUTES,
    { pattern: '/', capability: 'order.view' },
    { pattern: '/ops/orders', capability: 'order.view' },
    { pattern: '/ops/orders/*', capability: 'order.view' },
    { pattern: '/ops/refunds', capability: 'refund.decide' },
    { pattern: '/ops/refunds/*', capability: 'refund.decide' },
    { pattern: '/ops/disputes', capability: 'dispute.resolve' },
    { pattern: '/ops/disputes/*', capability: 'dispute.resolve' },
    { pattern: '/ops/payouts', capability: 'payout.release' },
    { pattern: '/ops/payouts/*', capability: 'payout.release' },
    { pattern: '/ops/cancellations/*', capability: 'cancellation.decide' },
    { pattern: '/ops/evidence/*', capability: 'evidence.read' },
]);

export const ROUTE_RULES: Readonly<Record<AppSurface, readonly RouteRule[]>> = Object.freeze({
  user: USER_RULES,
  manufacturer: MANUFACTURER_RULES,
  ops: OPS_RULES,
});

const normalisePath = (path: string): readonly string[] => {
  const withoutQuery = path.split('?')[0] ?? path;
  return withoutQuery.split('/').filter((segment) => segment !== '');
};

const matches = (pattern: string, path: string): boolean => {
  const patternSegments = normalisePath(pattern);
  const pathSegments = normalisePath(path);

  if (patternSegments.length === 0) return pathSegments.length === 0;

  for (let index = 0; index < patternSegments.length; index += 1) {
    const expected = patternSegments[index];
    if (expected === '**') return pathSegments.length > index;
    const actual = pathSegments[index];
    if (actual === undefined) return false;
    if (expected === '*') continue;
    if (expected !== actual) return false;
  }
  return pathSegments.length === patternSegments.length;
};

/** The most specific matching rule, or undefined when the path is unknown. */
export const resolveRouteRule = (
  surface: AppSurface,
  path: string,
): RouteRule | undefined => {
  const candidates = ROUTE_RULES[surface].filter((rule) => matches(rule.pattern, path));
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, rule) => {
    const score = (candidate: RouteRule): number =>
      normalisePath(candidate.pattern).filter((segment) => segment !== '**').length +
      (candidate.pattern.includes('**') ? 0 : 1);
    return score(rule) > score(best) ? rule : best;
  });
};

/**
 * Deny by default. A path with no rule is refused rather than allowed, so adding
 * a page without deciding who may see it fails closed.
 */
export const assertRouteAccess = (
  surface: AppSurface,
  path: string,
  actor: AuthenticatedActor | undefined,
): void => {
  const rule = resolveRouteRule(surface, path);
  if (rule === undefined) {
    throw new RouteForbiddenError(surface, path, 'no route rule matches');
  }
  if (rule.anonymous === true) return;
  if (actor === undefined) throw new NoSessionError(`route ${surface}:${path} needs a session`);

  const expectedRole = SURFACE_ROLE[surface];
  if (actor.role !== expectedRole) {
    throw new RouteForbiddenError(
      surface,
      path,
      `this surface serves ${expectedRole}, the actor is ${actor.role}`,
    );
  }
  if (rule.capability !== undefined && !can(actor.role, rule.capability)) {
    throw new RouteForbiddenError(
      surface,
      path,
      `role ${actor.role} does not hold ${rule.capability}`,
    );
  }
  if (actor.role === 'manufacturer' && actor.manufacturerId === undefined) {
    throw new RouteForbiddenError(
      surface,
      path,
      'a manufacturer session must act for a manufacturer',
    );
  }
};

export const isRouteAllowed = (
  surface: AppSurface,
  path: string,
  actor: AuthenticatedActor | undefined,
): boolean => {
  try {
    assertRouteAccess(surface, path, actor);
    return true;
  } catch {
    return false;
  }
};
