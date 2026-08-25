import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROUTE_RULES, isRouteAllowed, resolveRouteRule } from '@ideeza/auth';
import { asId, type ManufacturerId, type UserId } from '@ideeza/domain';
import type { AuthenticatedActor } from '@ideeza/auth';
import { PRIMARY_NAV, SECONDARY_NAV, MANUFACTURING_TABS } from '../src/lib/navigation.js';

const APP_DIR = resolve(process.cwd(), 'apps/user/src/app');

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
  email: 'buyer@example.test',
  role,
  manufacturerId:
    manufacturerId === undefined ? undefined : asId<ManufacturerId>(manufacturerId),
});

const buyer = actor('buyer');
const manufacturer = actor('manufacturer', 'mfr-a');
const ops = actor('ops_admin');

describe('every route in the app has a rule', () => {
  const routes = collectRoutes(APP_DIR).map(sampleFor);

  it('found the app routes', () => {
    expect(routes.length).toBeGreaterThan(20);
    expect(routes).toContain('/manufacturing');
    expect(routes).toContain('/auth/sign-in');
    expect(routes).toContain('/design-system');
  });

  it.each(routes)('%s resolves to a rule', (route) => {
    expect(resolveRouteRule('user', route)).toBeDefined();
  });

  it('lets a buyer reach every guarded route', () => {
    const refused = routes.filter((route) => !isRouteAllowed('user', route, buyer));
    expect(refused).toEqual([]);
  });
});

describe('the buyer surface refuses the other domains', () => {
  const guarded = ['/manufacturing', '/manufacturing/orders', '/messages', '/notifications'];

  it.each(guarded)('%s is refused for a manufacturer and for operations', (route) => {
    expect(isRouteAllowed('user', route, manufacturer)).toBe(false);
    expect(isRouteAllowed('user', route, ops)).toBe(false);
  });

  it('needs a session for every guarded route', () => {
    for (const route of guarded) {
      expect(isRouteAllowed('user', route, undefined)).toBe(false);
    }
  });

  it('serves sign-in, health and the gallery without a session', () => {
    for (const route of ['/auth/sign-in', '/health', '/design-system', '/forbidden', '/unavailable']) {
      expect(isRouteAllowed('user', route, undefined)).toBe(true);
    }
  });

  it('fails closed for a path nobody defined', () => {
    for (const route of ['/inventory', '/payouts', '/ops/payouts', '/rfqs', '/admin']) {
      expect(resolveRouteRule('user', route)).toBeUndefined();
      expect(isRouteAllowed('user', route, buyer)).toBe(false);
    }
  });
});

describe('no manufacturer or operations capability is reachable here', () => {
  it('keeps quote creation, production updates, inventory and payout release off this surface', () => {
    const capabilities = ROUTE_RULES.user
      .map((rule) => rule.capability)
      .filter((capability): capability is NonNullable<typeof capability> => capability !== undefined);

    for (const forbidden of [
      'quote.create',
      'quote.revise',
      'rfq.decline',
      'substitution.suggest',
      'production.update',
      'inventory.read',
      'inventory.write',
      'payout.release',
      'payout.withdraw',
      'refund.decide',
      'dispute.resolve',
      'cancellation.decide',
    ] as const) {
      expect(capabilities).not.toContain(forbidden);
    }
  });
});

describe('navigation', () => {
  it('exposes only buyer destinations, and every other entry says it is unavailable', () => {
    const flat = [...PRIMARY_NAV, ...SECONDARY_NAV].flatMap((entry) => [
      entry,
      ...(entry.children ?? []),
    ]);

    for (const entry of flat) {
      if (entry.href === undefined) {
        // A grouping row, or an entry that belongs to another module.
        if (entry.children === undefined) {
          expect(entry.unavailableReason).toBeTruthy();
        }
        continue;
      }
      expect(isRouteAllowed('user', entry.href, buyer)).toBe(true);
      expect(isRouteAllowed('user', entry.href, manufacturer)).toBe(false);
    }
  });

  it('never lists a manufacturer feature', () => {
    const labels = [...PRIMARY_NAV, ...SECONDARY_NAV]
      .flatMap((entry) => [entry, ...(entry.children ?? [])])
      .map((entry) => entry.label.toLowerCase());

    for (const forbidden of ['inventory', 'payout', 'production', 'rfq inbox']) {
      expect(labels.some((label) => label.includes(forbidden))).toBe(false);
    }
  });

  it('keeps the hub tabs pointing at the hub', () => {
    expect(MANUFACTURING_TABS.map((tab) => tab.id)).toEqual([
      'draft',
      'requests',
      'active',
      'history',
    ]);
    for (const tab of MANUFACTURING_TABS) {
      expect(tab.href.startsWith('/manufacturing')).toBe(true);
      expect(isRouteAllowed('user', tab.href, buyer)).toBe(true);
    }
  });
});
