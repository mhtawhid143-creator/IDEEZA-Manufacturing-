import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type ManufacturerId, type UserId } from '@ideeza/domain';
import type * as Resolution from '../src/data/resolution.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import { startTestDatabase, type TestDatabase } from '../../../packages/db/test-support/index.js';

/**
 * A refund claim the shop disagrees with, which is how a dispute is born.
 *
 * The one worth pinning hardest is the order's own status. A case open on an
 * order that still reads "in production" is two records contradicting each
 * other: the orders list cannot be filtered to find it, the counter that says
 * how many orders need attention counts none, and a shop is told nothing is
 * wrong while its payout is held.
 */
let database: TestDatabase;
let prisma: PrismaClient;
let resolution: typeof Resolution;

const SHOP = asId<ManufacturerId>('seed_mfr_a');
const OTHER = asId<ManufacturerId>('seed_mfr_c');
const ORDER = 'seed_order_1';
let member = asId<UserId>('seed_user_member_a');
let orderStatusBefore = 'in_production';

/** A fresh claim to answer, and the state the order was in before. */
const openClaim = async (id: string): Promise<void> => {
  await prisma.refund.upsert({
    where: { id },
    update: { status: 'requested', manufacturerRespondedAt: null },
    create: {
      id,
      orderId: ORDER,
      requestedById: 'seed_user_buyer',
      status: 'requested',
      reason: 'failed_quality_check',
      currency: 'USD',
      requestedAmountMinor: 30_000n,
      description: 'Nine boards out of 500 failed our incoming inspection on the RF pair.',
    },
  });
};

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  resolution = await import('../src/data/resolution.js');

  const membership = await prisma.manufacturerMember.findFirst({
    where: { manufacturerId: SHOP },
  });
  member = asId<UserId>(membership?.userId ?? 'seed_user_member_a');
  const order = await prisma.manufacturingOrder.findUnique({ where: { id: ORDER } });
  orderStatusBefore = order?.status ?? 'in_production';
});

afterAll(async () => {
  // The reference order is shared with several other suites; put it back.
  await prisma.manufacturingOrder
    .update({ where: { id: ORDER }, data: { status: orderStatusBefore as never } })
    .catch(() => undefined);
  await database?.stop();
});

describe('challenging a refund claim', () => {
  it('opens a case and moves the order to disputed, in one transaction', async () => {
    await openClaim('test_refund_challenge');

    const result = await resolution.challengeRefund(SHOP, member, 'test_refund_challenge', {
      acceptableAmountMinor: 0,
      statement:
        'The nine boards were within the tolerance on the accepted specification; our AOI and flying probe records for that panel are on the order.',
    });
    expect(result.ok).toBe(true);

    const dispute = await prisma.dispute.findFirst({
      where: { refundId: 'test_refund_challenge' },
    });
    expect(dispute?.status).toBe('open');
    // The claim is answered, and the order says so too.
    expect(
      (await prisma.refund.findUnique({ where: { id: 'test_refund_challenge' } }))?.status,
    ).toBe('mfr_responded');
    expect((await prisma.manufacturingOrder.findUnique({ where: { id: ORDER } }))?.status).toBe(
      'disputed',
    );

    // And the shop's own account of it is on the case as a statement.
    const view = await resolution.getDisputeCase(SHOP, dispute?.id ?? '');
    expect(view?.statements.some((row) => row.authorRole === 'manufacturer')).toBe(true);
    expect(view?.openedByShop).toBe(true);
  });

  it('will not answer a claim twice', async () => {
    const again = await resolution.challengeRefund(SHOP, member, 'test_refund_challenge', {
      acceptableAmountMinor: 0,
      statement: 'Saying it a second time does not make it a second answer to weigh.',
    });
    expect(again.ok).toBe(false);
    expect(await prisma.dispute.count({ where: { refundId: 'test_refund_challenge' } })).toBe(1);
  });

  it('will not answer a claim on another shop’s order', async () => {
    await openClaim('test_refund_not_mine');
    const result = await resolution.challengeRefund(OTHER, member, 'test_refund_not_mine', {
      acceptableAmountMinor: 0,
      statement: 'This claim belongs to somebody else entirely, and this should not reach it.',
    });
    expect(result.ok).toBe(false);
    expect(await prisma.dispute.count({ where: { refundId: 'test_refund_not_mine' } })).toBe(0);
  });

  it('refuses an answer nobody could weigh, or an amount above the claim', async () => {
    await openClaim('test_refund_bad_input');

    const short = await resolution.challengeRefund(SHOP, member, 'test_refund_bad_input', {
      acceptableAmountMinor: 0,
      statement: 'No.',
    });
    expect(short.ok).toBe(false);

    const tooMuch = await resolution.challengeRefund(SHOP, member, 'test_refund_bad_input', {
      // More than was claimed: the shop cannot offer to lose more than it is
      // being asked for, and a number that big is a typing mistake.
      acceptableAmountMinor: 90_000,
      statement: 'Offering more than the claim itself, which the claim cannot absorb.',
    });
    expect(tooMuch.ok).toBe(false);

    expect(await prisma.dispute.count({ where: { refundId: 'test_refund_bad_input' } })).toBe(0);
  });

  it('adds a statement to an open case, and refuses one on a closed case', async () => {
    const open = await prisma.dispute.findFirst({ where: { refundId: 'test_refund_challenge' } });
    expect(open).not.toBeNull();
    if (open === null) return;

    const added = await resolution.addDisputeStatement(
      SHOP,
      member,
      open.id,
      'The measurement records for that panel',
      'Attaching the flying probe report for the panel those nine boards came from, which shows every net within tolerance.',
    );
    expect(added.ok).toBe(true);
    // Answering moves the case off `open`, because it has been answered.
    expect((await prisma.dispute.findUnique({ where: { id: open.id } }))?.status).toBe(
      'responded',
    );

    const closed = await prisma.dispute.findFirst({ where: { status: 'resolved' } });
    if (closed !== null) {
      const late = await resolution.addDisputeStatement(
        SHOP,
        member,
        closed.id,
        'One more thing',
        'A decided case is closed to both sides, and this should be refused rather than filed.',
      );
      expect(late.ok).toBe(false);
    }
  });
});
