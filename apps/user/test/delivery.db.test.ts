import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { InvariantViolationError, asId, type OrderId, type UserId } from '@ideeza/domain';
import type { SaveDraftInput, SendRequestInput } from '@ideeza/types';
import type * as CheckoutData from '../src/data/checkout.js';
import type * as DeliveryData from '../src/data/delivery.js';
import type * as DraftData from '../src/data/drafts.js';
import type * as QuoteData from '../src/data/quotes.js';
import type * as RequestData from '../src/data/requests.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

let database: TestDatabase;
let prisma: PrismaClient;
let drafts: typeof DraftData;
let requests: typeof RequestData;
let quotes: typeof QuoteData;
let checkout: typeof CheckoutData;
let delivery: typeof DeliveryData;

const BUYER = asId<UserId>('seed_user_buyer');
const OTHER = asId<UserId>('seed_user_creator_a');
const MANUFACTURER = 'seed_mfr_a';

const draftInput = (quantity: number): SaveDraftInput => ({
  productId: 'seed_product_fpv_stack',
  kind: 'pcb',
  includedFileIds: ['seed_file_stack_gerber'],
  includedBomLineIds: ['seed_bom_stack_u1'],
  quantity,
  material: 'FR-4 TG150',
  manufacturingMethod: 'PCB fabrication + SMT assembly',
  tolerance: '+/-0.15mm',
  leadTimeDays: 21,
  shippingRequirement: 'Courier, tracked',
  assembly: 'smt',
  qualityCheckRequirement: 'AOI on 100%',
  substitutionPolicy: 'with_approval',
  deliveryAddress: { line1: '20/3, Sector 9', city: 'Dhaka', countryCode: 'BD' },
});

const sendInput = (rfqId: string, quantity: number): SendRequestInput => ({
  rfqId,
  requestedServices: ['pcb_fabrication', 'pcb_assembly'],
  manufacturerIds: [MANUFACTURER],
  quantity,
  assembly: 'smt',
  volumeTiers: [],
  deliveryAddress: { line1: '20/3, Sector 9', city: 'Dhaka', countryCode: 'BD' },
});

/**
 * Walks a product to a paid, confirmed order, then plays the manufacturer's part
 * up to delivery — which is what the manufacturer panel would do.
 */
const deliveredOrder = async (quantity: number): Promise<OrderId> => {
  const rfqId = await drafts.createDraft(BUYER, draftInput(quantity));
  await requests.submitRequest(BUYER, sendInput(rfqId, quantity));

  const quoteId = `dq_${quantity}`;
  await prisma.quote.create({
    data: {
      id: quoteId,
      rfqId,
      manufacturerId: MANUFACTURER,
      status: 'submitted',
      version: 1,
      quantity,
      currency: 'USD',
      unitPriceMinor: 500n,
      totalPriceMinor: BigInt(500 * quantity),
      shippingEstimateMinor: 8_400n,
      toolingSetupCostMinor: 0n,
      leadTimeDays: 18,
      materialProcessNotes: 'FR-4, ENIG, SMT',
      terms: '50% on confirmation',
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(),
    },
  });

  const accepted = await quotes.acceptQuote(BUYER, asId(quoteId));
  await checkout.payOrder(BUYER, {
    orderId: accepted.orderId,
    method: 'paypal',
    shippingChoice: 'standard',
    acceptTerms: true,
  });

  // The manufacturer runs production and ships. Only the states the buyer reads
  // are set here; the stages themselves were created by paying.
  await prisma.manufacturingOrder.update({
    where: { id: accepted.orderId },
    data: { status: 'shipped' },
  });
  await prisma.manufacturingOrder.update({
    where: { id: accepted.orderId },
    data: { status: 'delivered' },
  });
  await prisma.payout.create({
    data: {
      id: `po_${quantity}`,
      orderId: accepted.orderId,
      paymentId: (
        await prisma.manufacturingOrder.findUniqueOrThrow({
          where: { id: accepted.orderId },
          select: { paymentId: true },
        })
      ).paymentId as string,
      manufacturerId: MANUFACTURER,
      status: 'pending_release',
      currency: 'USD',
      orderAmountMinor: BigInt(500 * quantity),
      platformFeeMinor: 0n,
      netAmountMinor: BigInt(500 * quantity),
    },
  });
  await delivery.recordDelivery(accepted.orderId);

  return accepted.orderId;
};

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  drafts = await import('../src/data/drafts.js');
  requests = await import('../src/data/requests.js');
  quotes = await import('../src/data/quotes.js');
  checkout = await import('../src/data/checkout.js');
  delivery = await import('../src/data/delivery.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('delivery and the review window', () => {
  it('opens the review window when delivery is recorded', async () => {
    const orderId = await deliveredOrder(200);
    const view = await delivery.getDelivery(BUYER, orderId);

    expect(view?.status).toBe('delivered');
    expect(view?.reviewWindowOpen).toBe(true);
    expect(view?.reviewWindowDaysLeft).toBe(delivery.REVIEW_WINDOW_DAYS);
    expect(view?.canConfirmDelivery).toBe(true);
    expect(view?.payoutStatus).toBe('pending_release');
  });

  it('confirms delivery, completes the order and releases the money', async () => {
    const orderId = await deliveredOrder(201);
    const result = await delivery.confirmDelivery(BUYER, orderId, 'All 201 counted.');

    expect(result.status).toBe('completed');
    expect(result.payoutReleased).toBe(true);

    const order = await prisma.manufacturingOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { payment: true, payouts: true },
    });
    expect(order.status).toBe('completed');
    expect(order.completedAt).not.toBeNull();
    expect(order.payment?.status).toBe('released');
    expect(order.payouts[0]?.status).toBe('released');

    // The payout may only move against the event that justified it.
    const trigger = await prisma.domainEvent.findUniqueOrThrow({
      where: { id: order.payouts[0]?.releaseTriggerEventId ?? '' },
    });
    expect(trigger.kind).toBe('order_delivery_confirmed');

    const evidence = await prisma.evidence.findMany({
      where: { orderId, kind: 'delivery_record' },
    });
    expect(evidence[0]?.title).toBe('Delivery confirmed by the buyer');
  });

  it('refuses to confirm twice', async () => {
    const orderId = await deliveredOrder(202);
    await delivery.confirmDelivery(BUYER, orderId, undefined);
    await expect(delivery.confirmDelivery(BUYER, orderId, undefined)).rejects.toThrow(
      InvariantViolationError,
    );
  });

  it('refuses to confirm an order that has not been delivered', async () => {
    const orderId = await deliveredOrder(203);
    await prisma.manufacturingOrder.update({
      where: { id: orderId },
      data: { status: 'in_production' },
    });
    await expect(delivery.confirmDelivery(BUYER, orderId, undefined)).rejects.toThrow(
      InvariantViolationError,
    );
  });

  it('refuses a confirmation from anyone but the buyer', async () => {
    const orderId = await deliveredOrder(204);
    await expect(delivery.confirmDelivery(OTHER, orderId, undefined)).rejects.toThrow(
      /does not exist/,
    );
  });

  it('holds the payout while a refund is open, and still completes the order', async () => {
    const orderId = await deliveredOrder(205);
    await prisma.refund.create({
      data: {
        id: `rf_205`,
        orderId,
        requestedById: BUYER,
        status: 'requested',
        reason: 'defective_units',
        description: 'Two boards failed our incoming test.',
        currency: 'USD',
        requestedAmountMinor: 1_000n,
      },
    });

    const result = await delivery.confirmDelivery(BUYER, orderId, undefined);
    expect(result.status).toBe('completed');
    expect(result.payoutReleased).toBe(false);

    const payout = await prisma.payout.findFirstOrThrow({ where: { orderId } });
    expect(payout.status).toBe('pending_release');
  });
});

describe('reviewing the manufacturer', () => {
  it('publishes one review and recomputes the public rating', async () => {
    const orderId = await deliveredOrder(206);
    const before = await prisma.manufacturerProfile.findUniqueOrThrow({
      where: { id: MANUFACTURER },
    });

    const result = await delivery.publishReview(BUYER, {
      orderId,
      rating: 4,
      body: 'Good communication, one part substituted with approval.',
      anonymous: false,
    });

    expect(result.manufacturerRating).not.toBeNull();
    const after = await prisma.manufacturerProfile.findUniqueOrThrow({
      where: { id: MANUFACTURER },
    });
    expect(Number(after.rating)).toBe(result.manufacturerRating);
    expect(Number(after.rating)).not.toBe(Number(before.rating ?? 0));

    const event = await prisma.domainEvent.findFirstOrThrow({
      where: { subjectId: result.reviewId },
    });
    expect(event.kind).toBe('review_published');
  });

  it('refuses a second review of the same order', async () => {
    const orderId = await deliveredOrder(207);
    await delivery.publishReview(BUYER, { orderId, rating: 5, anonymous: false });
    await expect(
      delivery.publishReview(BUYER, { orderId, rating: 1, anonymous: false }),
    ).rejects.toThrow(InvariantViolationError);
  });

  it('refuses a review before delivery', async () => {
    const orderId = await deliveredOrder(208);
    await prisma.manufacturingOrder.update({
      where: { id: orderId },
      data: { deliveredAt: null, status: 'in_production' },
    });
    await expect(
      delivery.publishReview(BUYER, { orderId, rating: 5, anonymous: false }),
    ).rejects.toThrow(InvariantViolationError);
  });

  it('keeps an anonymous review as a rating without a name shown', async () => {
    const orderId = await deliveredOrder(209);
    await delivery.publishReview(BUYER, { orderId, rating: 3, anonymous: true });
    const view = await delivery.getDelivery(BUYER, orderId);
    expect(view?.review?.anonymous).toBe(true);
    expect(view?.review?.rating).toBe(3);
    expect(view?.canReview).toBe(false);
  });
});

describe('order history', () => {
  it('lists what is finished with the outcome it ended in', async () => {
    const delivered = await deliveredOrder(210);
    const completed = await deliveredOrder(211);
    await delivery.confirmDelivery(BUYER, completed, undefined);

    const history = await delivery.listHistory(BUYER);
    const ids = history.map((row) => String(row.orderId));

    expect(ids).toContain(String(delivered));
    expect(ids).toContain(String(completed));

    const closed = history.find((row) => String(row.orderId) === String(completed));
    expect(closed?.outcome).toBe('Completed, money released');

    const open = history.find((row) => String(row.orderId) === String(delivered));
    expect(open?.outcome).toBe('Delivered, review window open');
    expect(open?.canReview).toBe(true);
  });

  it('does not list an order that is still being made', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput(212));
    await requests.submitRequest(BUYER, sendInput(rfqId, 212));
    const history = await delivery.listHistory(BUYER);
    expect(history.every((row) => row.rfqId !== rfqId)).toBe(true);
  });
});

describe('ordering the same thing again', () => {
  it('copies the request into a new draft', async () => {
    const orderId = await deliveredOrder(213);
    await delivery.confirmDelivery(BUYER, orderId, undefined);

    const source = await prisma.manufacturingOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { rfq: { include: { requirements: true, package: true } } },
    });

    const draft = await drafts.createDraftFromOrder(BUYER, String(orderId));
    const copy = await prisma.rfq.findUniqueOrThrow({
      where: { id: draft.rfqId },
      include: {
        requirements: true,
        package: { include: { files: true, bomLines: true } },
      },
    });

    expect(copy.status).toBe('draft');
    expect(copy.quantity).toBe(source.rfq.quantity);
    expect(copy.package.kind).toBe(source.rfq.package.kind);
    expect(copy.requirements.material).toBe(source.rfq.requirements.material);
    expect(copy.package.files.length).toBeGreaterThan(0);
    // A new draft, not a copy of the order: no quote and no terms come with it.
    expect(copy.id).not.toBe(source.rfqId);
  });

  it('refuses another buyer’s order', async () => {
    const orderId = await deliveredOrder(214);
    await expect(drafts.createDraftFromOrder(OTHER, String(orderId))).rejects.toThrow(
      /does not exist/,
    );
  });
});
