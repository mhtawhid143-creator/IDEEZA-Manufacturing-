import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type ManufacturerId } from '@ideeza/domain';
import type * as Dashboard from '../src/data/dashboard.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

/**
 * UIUX-113 (MFG-08), with UIUX-108 (MFG-03) and UIUX-111 (MFG-06) — the ticket
 * asks for all three as one panel.
 *
 * The decision recorded on the ticket: the Production Status panel carries
 * **exactly four** universal stages, the same for a board shop and a printing
 * shop — Queued, In production, Quality check, Awaiting shipment. No
 * process-specific name appears at this level. "Delayed" is not a fifth stage:
 * it is a cross-cutting flag that can happen at any of the four, so it is
 * counted separately. And the same panel can be scoped to one kind of work
 * rather than being built twice.
 */
let database: TestDatabase;
let prisma: PrismaClient;
let dashboard: typeof Dashboard;

const SHOP = asId<ManufacturerId>('seed_mfr_a');

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  dashboard = await import('../src/data/dashboard.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('the production status panel', () => {
  it('carries exactly the four universal stages, in order', async () => {
    const sections = await dashboard.getDashboardSections(SHOP);
    expect(sections.production.map((bar) => bar.label)).toEqual([
      'Queued',
      'In production',
      'Quality check',
      'Awaiting shipment',
    ]);
  });

  it('counts what needs attention separately, because it is not a stage', async () => {
    const sections = await dashboard.getDashboardSections(SHOP);
    // A flag rather than a row: an order can need attention while it is queued,
    // in production, or waiting to ship, so it cannot be a place in a sequence.
    expect(typeof sections.needingAttention).toBe('number');
    expect(sections.production.some((bar) => /attention|delayed/i.test(bar.label))).toBe(
      false,
    );
  });

  it('keeps the count of what has already gone out, without making it a stage', async () => {
    const sections = await dashboard.getDashboardSections(SHOP);
    expect(typeof sections.shippedOrDelivered).toBe('number');
    expect(sections.production.some((bar) => /shipped|delivered/i.test(bar.label))).toBe(
      false,
    );
  });

  it('scopes to one kind of work without a second panel', async () => {
    const all = await dashboard.getDashboardSections(SHOP);
    const boards = await dashboard.getDashboardSections(SHOP, { work: 'pcb' });
    const printed = await dashboard.getDashboardSections(SHOP, { work: 'module_3d' });

    // The stage names never change with the filter — that is the whole point of
    // a universal set.
    expect(boards.production.map((bar) => bar.label)).toEqual(
      all.production.map((bar) => bar.label),
    );

    const sum = (rows: readonly { readonly count: number }[]): number =>
      rows.reduce((total, row) => total + row.count, 0);
    // Neither scope can hold more than everything.
    expect(sum(boards.production)).toBeLessThanOrEqual(sum(all.production));
    expect(sum(printed.production)).toBeLessThanOrEqual(sum(all.production));
    // And between them they cover it, because a full product is both a board
    // and a printed part — so a mixed order is counted under each, and the two
    // scopes may legitimately overlap rather than partition.
    expect(sum(boards.production) + sum(printed.production)).toBeGreaterThanOrEqual(
      sum(all.production),
    );
  });
});
