import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROUTE_RULES, isRouteAllowed, resolveRouteRule } from '@ideeza/auth';
import type { AuthenticatedActor } from '@ideeza/auth';
import { asId, type ManufacturerId, type UserId } from '@ideeza/domain';
import { PRIMARY_NAV, SECONDARY_NAV, isNavEntryActive } from '../src/lib/navigation.js';

const APP_DIR = resolve(process.cwd(), 'apps/manufacturer/src/app');

/**
 * Walks the app directory and turns every page into the path a visitor would
 * ask for: route groups in brackets disappear, and a dynamic segment becomes a
 * sample value.
 */
const collectRoutes = (directory: string, prefix = ''): readonly string[] => {
  const entries = readdirSync(directory);
  const routes: string[] = [];

  for (const entry of entries) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      const segment = entry.startsWith('(') && entry.endsWith(')') ? '' : `/${entry}`;
      routes.push(...collectRoutes(full, `${prefix}${segment}`));
      continue;
    }
    if (entry === 'page.tsx' || entry === 'route.ts') {
      routes.push(prefix === '' ? '/' : prefix);
    }
  }

  return routes;
};

const sampleFor = (route: string): string =>
  route.replace(/\[([^\]]+)\]/g, (_match, name: string) => `sample-${name}`);

const actor = (
  role: AuthenticatedActor['role'],
  manufacturerId?: string,
): AuthenticatedActor => ({
  sessionId: 'sess_test',
  userId: asId<UserId>('user-1'),
  email: 'shop@example.test',
  role,
  manufacturerId:
    manufacturerId === undefined ? undefined : asId<ManufacturerId>(manufacturerId),
});

const manufacturer = actor('manufacturer', 'mfr-a');
const buyer = actor('buyer');
const ops = actor('ops_admin');

describe('every route in the manufacturer app has a rule', () => {
  const routes = collectRoutes(APP_DIR).map(sampleFor);

  it('found the app routes', () => {
    expect(routes.length).toBeGreaterThan(5);
    expect(routes).toContain('/dashboard');
    expect(routes).toContain('/auth/sign-in');
    expect(routes).toContain('/design-system');
    expect(routes).toContain('/health');
  });

  it.each(routes)('%s resolves to a rule', (route) => {
    expect(resolveRouteRule('manufacturer', route)).toBeDefined();
  });

  it('lets a manufacturer member reach every guarded route', () => {
    const refused = routes.filter(
      (route) => !isRouteAllowed('manufacturer', route, manufacturer),
    );
    expect(refused).toEqual([]);
  });
});

describe('the manufacturer surface refuses the other domains', () => {
  const guarded = ['/dashboard', '/rfqs', '/quotes', '/orders', '/inventory', '/payouts'];

  it.each(guarded)('%s is refused for a buyer and for operations', (route) => {
    expect(isRouteAllowed('manufacturer', route, buyer)).toBe(false);
    expect(isRouteAllowed('manufacturer', route, ops)).toBe(false);
  });

  it('needs a session for every guarded route', () => {
    for (const route of guarded) {
      expect(isRouteAllowed('manufacturer', route, undefined)).toBe(false);
    }
  });

  it('serves sign-in, health and the gallery without a session', () => {
    for (const route of [
      '/auth/sign-in',
      '/health',
      '/design-system',
      '/forbidden',
      '/unavailable',
    ]) {
      expect(isRouteAllowed('manufacturer', route, undefined)).toBe(true);
    }
  });

  it('fails closed for a buyer path, which does not exist here', () => {
    for (const route of [
      '/manufacturing',
      '/favorites',
      '/products/sample',
      '/manufacturing/checkout/sample',
      '/ops/payouts',
    ]) {
      expect(resolveRouteRule('manufacturer', route)).toBeUndefined();
      expect(isRouteAllowed('manufacturer', route, manufacturer)).toBe(false);
    }
  });
});

describe('no buyer or operations capability is reachable here', () => {
  it('keeps the buyer acts and the operations decisions off this surface', () => {
    const capabilities = ROUTE_RULES.manufacturer
      .map((rule) => rule.capability)
      .filter(
        (capability): capability is NonNullable<typeof capability> =>
          capability !== undefined,
      );

    for (const forbidden of [
      'product.browse',
      'product.favorite',
      'rfq.create',
      'rfq.withdraw',
      'quote.accept',
      'quote.reject',
      'substitution.decide',
      'checkout.pay',
      'delivery.confirm',
      'review.publish',
      'refund.request',
      'refund.decide',
      'dispute.resolve',
      'cancellation.decide',
      'payout.release',
    ] as const) {
      expect(capabilities).not.toContain(forbidden);
    }
  });
});

describe('navigation', () => {
  it('points only at manufacturer destinations, and marks the rest unavailable', () => {
    for (const entry of [...PRIMARY_NAV, ...SECONDARY_NAV]) {
      if (entry.href === undefined) {
        // A row with no destination is one of two things and never a third: it
        // opens something in place, or it says why it cannot be followed.
        expect(entry.opens ?? entry.unavailableReason).toBeTruthy();
        continue;
      }
      // Every destination is in the route table even before its screen exists,
      // so the guard is decided once and the rail only has to decide whether to
      // render a link or the reason it cannot yet.
      expect(resolveRouteRule('manufacturer', entry.href)).toBeDefined();
      expect(isRouteAllowed('manufacturer', entry.href, manufacturer)).toBe(true);
    }
  });

  it('links only to screens that exist, and explains the rest', () => {
    const built = new Set(collectRoutes(APP_DIR));
    for (const entry of PRIMARY_NAV) {
      if (entry.href === undefined) continue;
      if (entry.unavailableReason === undefined) {
        expect(built.has(entry.href)).toBe(true);
      } else {
        expect(built.has(entry.href)).toBe(false);
      }
    }
  });

  it('marks the current section, and only that one', () => {
    const rfqs = PRIMARY_NAV.find((entry) => entry.id === 'rfqs');
    const quotes = PRIMARY_NAV.find((entry) => entry.id === 'quotes');
    expect(rfqs === undefined ? false : isNavEntryActive(rfqs, '/rfqs/abc')).toBe(true);
    expect(quotes === undefined ? true : isNavEntryActive(quotes, '/rfqs/abc')).toBe(false);
  });
});
