import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type ManufacturerId } from '@ideeza/domain';
import type * as Payouts from '../src/data/payouts.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

/**
 * UIUX-224 (MFG-126): a disputed payout has to say what it is disputed about.
 *
 * The finding, in the reporter's words: "the modal shows the identical set of
 * fields no matter what Status is — when a row's Status is Disputed, opening its
 * breakdown gives no dispute reason, no evidence, and no link to wherever the
 * dispute is actually being handled."
 *
 * This build has no breakdown modal, so the same duty falls on the payout row
 * itself: it already says "Disputed" and offers only "Open the order". What is
 * pinned here is the rest — the reason, and the way to the case.
 */
let database: TestDatabase;
let prisma: PrismaClient;
let payouts: typeof Payouts;

const SHOP = asId<ManufacturerId>('seed_mfr_a');

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  payouts = await import('../src/data/payouts.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('a disputed payout', () => {
  it('carries the case it is disputed about, and its reason', async () => {
    const payout = await prisma.payout.findFirst({ where: { manufacturerId: SHOP } });
    expect(payout).not.toBeNull();
    if (payout === null) return;

    const dispute = await prisma.dispute.findFirst({ where: { orderId: payout.orderId } });
    expect(dispute).not.toBeNull();
    if (dispute === null) return;

    await prisma.payout.update({ where: { id: payout.id }, data: { status: 'disputed' } });

    const page = await payouts.listPayouts(SHOP, { status: 'disputed' });
    const row = page.rows.find((candidate) => candidate.id === payout.id);
    expect(row).toBeDefined();
    expect(row?.disputeId).toBe(dispute.id);
    // The reason is the domain's own value, so the screen can put the shared
    // words on it and both panels say the same thing about the same case.
    expect(row?.disputeReason).toBe(dispute.reason);

    await prisma.payout.update({ where: { id: payout.id }, data: { status: payout.status } });
  });

  it('says nothing about a case on a payout that has none', async () => {
    const page = await payouts.listPayouts(SHOP, { status: 'released' });
    for (const row of page.rows) {
      expect(row.disputeId).toBeNull();
      expect(row.disputeReason).toBeNull();
    }
  });

  it('prefers the case still open when an order has more than one', async () => {
    const payout = await prisma.payout.findFirst({ where: { manufacturerId: SHOP } });
    if (payout === null) return;
    const existing = await prisma.dispute.findFirst({ where: { orderId: payout.orderId } });
    if (existing === null) return;

    // The seeded case on this order is already resolved. A second one, still
    // open, is what the shop has to answer — and it is the one holding the
    // money, so it is the one the row must name.
    expect(existing.resolvedAt).not.toBeNull();
    await prisma.dispute.create({
      data: {
        id: 'test_dispute_still_open',
        orderId: payout.orderId,
        refundId: null,
        openedById: existing.openedById,
        currency: existing.currency,
        claimedAmountMinor: existing.claimedAmountMinor,
        reason: 'late_delivery',
        status: 'open',
      },
    });
    await prisma.payout.update({ where: { id: payout.id }, data: { status: 'disputed' } });

    const page = await payouts.listPayouts(SHOP, { status: 'disputed' });
    const row = page.rows.find((candidate) => candidate.id === payout.id);
    expect(row?.disputeId).toBe('test_dispute_still_open');
    expect(row?.disputeReason).toBe('late_delivery');

    await prisma.dispute.delete({ where: { id: 'test_dispute_still_open' } });
    await prisma.payout.update({ where: { id: payout.id }, data: { status: payout.status } });
  });
});
