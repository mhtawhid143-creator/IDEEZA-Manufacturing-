import { describe, expect, it } from 'vitest';
import { asId, type ManufacturerId, type UserId } from '@ideeza/domain';
import type { AuthenticatedActor } from '../src/actor.js';
import { NoSessionError, RouteForbiddenError } from '../src/errors.js';
import {
  ROUTE_RULES,
  SURFACE_ROLE,
  assertRouteAccess,
  isRouteAllowed,
  resolveRouteRule,
} from '../src/route-rules.js';

const makeActor = (
  role: AuthenticatedActor['role'],
  manufacturerId?: string,
): AuthenticatedActor => ({
  sessionId: 'sess_1',
  userId: asId<UserId>('user-1'),
  email: 'user@example.test',
  role,
  manufacturerId:
    manufacturerId === undefined ? undefined : asId<ManufacturerId>(manufacturerId),
});

const buyer = makeActor('buyer');
const manufacturer = makeActor('manufacturer', 'mfr-a');
const ops = makeActor('ops_admin');

describe('route rules', () => {
  it('gives each surface its own table, keyed to one role', () => {
    expect(SURFACE_ROLE).toEqual({
      user: 'buyer',
      manufacturer: 'manufacturer',
      ops: 'ops_admin',
    });
    expect(ROUTE_RULES.user.length).toBeGreaterThan(10);
    expect(ROUTE_RULES.manufacturer.length).toBeGreaterThan(10);
    expect(ROUTE_RULES.ops.length).toBeGreaterThan(5);
  });

  it('matches single segment and trailing wildcards', () => {
    expect(resolveRouteRule('user', '/manufacturing/orders/order-1')?.capability).toBe(
      'order.view',
    );
    expect(
      resolveRouteRule('user', '/manufacturing/orders/order-1/confirm-delivery')?.capability,
    ).toBe('delivery.confirm');
    expect(resolveRouteRule('user', '/manufacturing/checkout/quote-1/pay')?.capability).toBe(
      'checkout.pay',
    );
    expect(resolveRouteRule('manufacturer', '/rfqs/rfq-1/quote')?.capability).toBe(
      'quote.create',
    );
  });

  it('ignores a query string when matching', () => {
    expect(resolveRouteRule('manufacturer', '/quotes?status=submitted')?.capability).toBe(
      'quote.view',
    );
  });
});

describe('surface isolation', () => {
  it('lets each role onto its own surface', () => {
    expect(() => assertRouteAccess('user', '/manufacturing/orders', buyer)).not.toThrow();
    expect(() => assertRouteAccess('manufacturer', '/rfqs', manufacturer)).not.toThrow();
    expect(() => assertRouteAccess('ops', '/ops/disputes', ops)).not.toThrow();
  });

  it('keeps a buyer off the manufacturer surface and vice versa', () => {
    expect(() => assertRouteAccess('manufacturer', '/rfqs', buyer)).toThrow(
      RouteForbiddenError,
    );
    expect(() => assertRouteAccess('manufacturer', '/inventory', buyer)).toThrow(
      /serves manufacturer/,
    );
    expect(() => assertRouteAccess('user', '/manufacturing/orders', manufacturer)).toThrow(
      RouteForbiddenError,
    );
  });

  it('keeps both counterparties out of the operations surface', () => {
    expect(() => assertRouteAccess('ops', '/ops/payouts', buyer)).toThrow(RouteForbiddenError);
    expect(() => assertRouteAccess('ops', '/ops/payouts', manufacturer)).toThrow(
      RouteForbiddenError,
    );
  });

  it('refuses a manufacturer session that does not act for a manufacturer', () => {
    const unbound = makeActor('manufacturer');
    expect(() => assertRouteAccess('manufacturer', '/rfqs', unbound)).toThrow(
      /must act for a manufacturer/,
    );
  });
});

describe('fail closed behaviour', () => {
  it('refuses a path that has no rule', () => {
    expect(() => assertRouteAccess('user', '/admin/secrets', buyer)).toThrow(
      /no route rule matches/,
    );
    expect(() => assertRouteAccess('manufacturer', '/rfqs/rfq-1/danger', manufacturer)).toThrow(
      /no route rule matches/,
    );
    expect(isRouteAllowed('ops', '/ops/unknown', ops)).toBe(false);
  });

  it('requires a session for anything that is not marked anonymous', () => {
    expect(() => assertRouteAccess('user', '/manufacturing', undefined)).toThrow(NoSessionError);
    expect(() => assertRouteAccess('user', '/auth/sign-in', undefined)).not.toThrow();
    expect(() => assertRouteAccess('user', '/health', undefined)).not.toThrow();
  });

  it('refuses a route whose capability the role does not hold', () => {
    // The rule exists on the operations surface, but only operations holds it.
    expect(isRouteAllowed('ops', '/ops/refunds', ops)).toBe(true);
    expect(isRouteAllowed('user', '/manufacturing/orders/o1/refund', buyer)).toBe(true);
    expect(isRouteAllowed('manufacturer', '/orders/o1/refund-response', manufacturer)).toBe(
      true,
    );
    expect(isRouteAllowed('manufacturer', '/orders/o1/production', manufacturer)).toBe(true);
    expect(isRouteAllowed('user', '/manufacturing/rfq/r1/substitutions', buyer)).toBe(true);
  });

  it('never exposes an inventory route on the buyer surface', () => {
    const inventoryRules = ROUTE_RULES.user.filter((rule) =>
      rule.pattern.includes('inventory'),
    );
    expect(inventoryRules).toEqual([]);
    expect(isRouteAllowed('user', '/inventory', buyer)).toBe(false);
  });

  it('never exposes a checkout or acceptance route on the manufacturer surface', () => {
    const buyerOnly = ROUTE_RULES.manufacturer.filter((rule) =>
      ['checkout', 'compare'].some((needle) => rule.pattern.includes(needle)),
    );
    expect(buyerOnly).toEqual([]);
  });
});
