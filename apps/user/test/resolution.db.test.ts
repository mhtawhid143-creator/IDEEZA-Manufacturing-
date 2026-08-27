import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { InvariantViolationError, asId, type OrderId, type UserId } from '@ideeza/domain';
import type { SaveDraftInput, SendRequestInput } from '@ideeza/types';
import type * as CheckoutData from '../src/data/checkout.js';
import type * as DraftData from '../src/data/drafts.js';
import type * as QuoteData from '../src/data/quotes.js';
import type * as RequestData from '../src/data/requests.js';
import type * as ResolutionData from '../src/data/resolution.js';
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
let resolution: typeof ResolutionData;

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

/** An order that has been accepted but not paid for. */
const unpaidOrder = async (quantity: number): Promise<OrderId> => {
  const rfqId = await drafts.createDraft(BUYER, draftInput(quantity));
  const send: SendRequestInput = {
    rfqId,
    requestedServices: ['pcb_fabrication'],
    manufacturerIds: [MANUFACTURER],
    quantity,
    assembly: 'smt',
    volumeTiers: [],
    deliveryAddress: { line1: '20/3, Sector 9', city: 'Dhaka', countryCode: 'BD' },
  };
  await requests.submitRequest(BUYER, send);

  const quoteId = `rq_${quantity}`;
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
  return accepted.orderId;
};

/** The same order, paid for and pushed to a state the manufacturer would set. */
const orderInState = async (
  quantity: number,
  status: 'confirmed' | 'in_production' | 'delivered',
): Promise<OrderId> => {
  const orderId = await unpaidOrder(quantity);
  await checkout.payOrder(BUYER, {
    orderId,
    method: 'paypal',
    shippingChoice: 'standard',
    acceptTerms: true,
  });
  if (status !== 'confirmed') {
    await prisma.manufacturingOrder.update({
      where: { id: orderId },
      data: { status: status === 'delivered' ? 'shipped' : status },
    });
    if (status === 'delivered') {
      await prisma.manufacturingOrder.update({
        where: { id: orderId },
        data: { status: 'delivered', deliveredAt: new Date() },
      });
    }
  }
  return orderId;
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
  resolution = await import('../src/data/resolution.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('what the buyer may raise', () => {
  it('offers a withdrawal on an unpaid order, and no refund or dispute', async () => {
    const orderId = await unpaidOrder(300);
    const context = await resolution.getIssueContext(BUYER, orderId);

    expect(context?.cancellationRoute).toBe('withdraw');
    expect(context?.cancelBlockedReason).toBeNull();
    expect(context?.fundsHeld).toBe(false);
    expect(context?.refundBlockedReason).toMatch(/nothing was paid/);
    expect(context?.disputeBlockedReason).toMatch(/nothing to dispute/);
  });

  it('offers a cancellation request and a dispute while it is being made, but no refund', async () => {
    const orderId = await orderInState(301, 'in_production');
    const context = await resolution.getIssueContext(BUYER, orderId);

    expect(context?.cancellationRoute).toBe('request');
    expect(context?.disputeBlockedReason).toBeNull();
    expect(context?.heldMinor).toBeGreaterThan(0);
    // Nothing has been delivered, so there is nothing to refund yet: the order
    // lifecycle only admits a refund request from shipped onwards.
    expect(context?.refundBlockedReason).toMatch(/nothing has been delivered yet/);
    // The design files sent with the request are always attachable.
    expect(context?.attachable.length).toBeGreaterThan(0);
  });

  it('offers a refund once the units are delivered', async () => {
    const orderId = await orderInState(317, 'delivered');
    const context = await resolution.getIssueContext(BUYER, orderId);
    expect(context?.refundBlockedReason).toBeNull();
    expect(context?.paidMinor).toBeGreaterThan(0);
  });

  it('refuses a cancellation once the units have shipped', async () => {
    const orderId = await orderInState(302, 'delivered');
    const context = await resolution.getIssueContext(BUYER, orderId);
    expect(context?.cancelBlockedReason).toMatch(/refund or open a dispute/);
  });

  it('shows another buyer nothing', async () => {
    const orderId = await unpaidOrder(303);
    expect(await resolution.getIssueContext(OTHER, orderId)).toBeNull();
  });
});

describe('cancelling', () => {
  it('withdraws an unpaid order outright', async () => {
    const orderId = await unpaidOrder(304);
    const result = await resolution.cancelOrder(BUYER, {
      orderId: String(orderId),
      reason: 'design_change',
      description: 'The enclosure changed, so the board outline changes with it.',
    });

    expect(result.route).toBe('withdraw');
    expect(result.status).toBe('cancelled');

    const order = await prisma.manufacturingOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(order.status).toBe('cancelled');

    const events = await prisma.domainEvent.findMany({ where: { orderId } });
    expect(events.map((event) => event.kind)).toContain('order_cancelled');
  });

  it('only requests a cancellation once the money is held', async () => {
    const orderId = await orderInState(305, 'in_production');
    const result = await resolution.cancelOrder(BUYER, {
      orderId: String(orderId),
      reason: 'funding_withdrawn',
      description: 'Our round closed short and we cannot take the units this quarter.',
    });

    expect(result.route).toBe('request');
    expect(result.status).toBe('cancel_requested');

    const order = await prisma.manufacturingOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { payment: true },
    });
    // The money is untouched: only IDEEZA decides what happens to it.
    expect(order.payment?.status).toBe('secured');

    const events = await prisma.domainEvent.findMany({ where: { orderId } });
    expect(events.map((event) => event.kind)).toContain('order_cancel_requested');
  });

  it('refuses a second cancellation request', async () => {
    const orderId = await orderInState(306, 'in_production');
    await resolution.cancelOrder(BUYER, {
      orderId: String(orderId),
      reason: 'other',
      description: 'Stopping the programme for now.',
    });
    await expect(
      resolution.cancelOrder(BUYER, {
        orderId: String(orderId),
        reason: 'other',
        description: 'Asking again.',
      }),
    ).rejects.toThrow(InvariantViolationError);
  });

  it('keeps a statement of why, on the record', async () => {
    const orderId = await unpaidOrder(307);
    await resolution.cancelOrder(BUYER, {
      orderId: String(orderId),
      reason: 'ordered_by_mistake',
      description: 'Sent to the wrong manufacturer.',
    });
    const evidence = await prisma.evidence.findMany({
      where: { orderId, kind: 'buyer_statement' },
    });
    expect(evidence[0]?.title).toMatch(/Cancellation/);
  });
});

describe('refund claims', () => {
  it('records the claim, stops the payout and moves the order', async () => {
    const orderId = await orderInState(308, 'delivered');
    const context = await resolution.getIssueContext(BUYER, orderId);
    const fileId = context?.attachable[0]?.fileId ?? '';

    const result = await resolution.requestRefund(BUYER, {
      orderId: String(orderId),
      reason: 'defective_units',
      requestedAmount: { amountMinor: 5_000, currency: 'USD' },
      description: 'Eleven of the boards failed our incoming functional test.',
      evidenceFileIds: [fileId],
    });

    expect(result.orderStatus).toBe('refund_requested');

    const refund = await prisma.refund.findUniqueOrThrow({ where: { id: result.refundId } });
    expect(refund.status).toBe('requested');
    expect(Number(refund.requestedAmountMinor)).toBe(5_000);

    const evidence = await prisma.evidence.findMany({
      where: { refundId: result.refundId },
    });
    // The statement, plus the record it points at.
    expect(evidence.length).toBe(2);

    const events = await prisma.domainEvent.findMany({ where: { orderId } });
    expect(events.map((event) => event.kind)).toContain('refund_requested');
  });

  it('refuses a claim larger than what was paid', async () => {
    const orderId = await orderInState(309, 'delivered');
    const context = await resolution.getIssueContext(BUYER, orderId);

    await expect(
      resolution.requestRefund(BUYER, {
        orderId: String(orderId),
        reason: 'wrong_quantity',
        requestedAmount: {
          amountMinor: (context?.paidMinor ?? 0) + 1,
          currency: 'USD',
        },
        description: 'Twenty units short of the accepted quantity.',
        evidenceFileIds: [context?.attachable[0]?.fileId ?? ''],
      }),
    ).rejects.toThrow(/larger than what was paid/);
  });

  it('refuses a claim with no record attached', async () => {
    const orderId = await orderInState(310, 'delivered');
    await expect(
      resolution.requestRefund(BUYER, {
        orderId: String(orderId),
        reason: 'late_delivery',
        requestedAmount: { amountMinor: 1_000, currency: 'USD' },
        description: 'Arrived three weeks after the quoted lead time.',
        evidenceFileIds: [],
      }),
    ).rejects.toThrow(/at least one record/);
  });

  it('allows one open claim per order', async () => {
    const orderId = await orderInState(311, 'delivered');
    const context = await resolution.getIssueContext(BUYER, orderId);
    const files = [context?.attachable[0]?.fileId ?? ''];

    await resolution.requestRefund(BUYER, {
      orderId: String(orderId),
      reason: 'defective_units',
      requestedAmount: { amountMinor: 1_000, currency: 'USD' },
      description: 'Two boards arrived with lifted pads on the connector.',
      evidenceFileIds: files,
    });

    await expect(
      resolution.requestRefund(BUYER, {
        orderId: String(orderId),
        reason: 'defective_units',
        requestedAmount: { amountMinor: 1_000, currency: 'USD' },
        description: 'Another claim on the same order.',
        evidenceFileIds: files,
      }),
    ).rejects.toThrow(InvariantViolationError);
  });
});

describe('disputes', () => {
  it('opens a case with the opening statement on the record', async () => {
    const orderId = await orderInState(312, 'delivered');
    const context = await resolution.getIssueContext(BUYER, orderId);

    const result = await resolution.openDispute(BUYER, {
      orderId: String(orderId),
      reason: 'wrong_specification',
      claimedAmount: { amountMinor: 4_000, currency: 'USD' },
      statement: 'The boards came back with HASL, and the accepted terms said ENIG.',
      evidenceFileIds: [context?.attachable[0]?.fileId ?? ''],
    });

    expect(result.orderStatus).toBe('disputed');

    const view = await resolution.getDispute(BUYER, result.disputeId);
    expect(view?.status).toBe('open');
    expect(view?.statements).toHaveLength(1);
    expect(view?.statements[0]?.body).toMatch(/HASL/);
    expect(view?.attachments.length).toBe(1);
    expect(view?.canAddStatement).toBe(true);
  });

  it('takes further statements while the case is live, and none after', async () => {
    const orderId = await orderInState(313, 'delivered');
    const context = await resolution.getIssueContext(BUYER, orderId);
    const opened = await resolution.openDispute(BUYER, {
      orderId: String(orderId),
      reason: 'failed_quality_check',
      claimedAmount: { amountMinor: 2_000, currency: 'USD' },
      statement: 'Our AOI found solder bridges on twelve boards out of the batch.',
      evidenceFileIds: [context?.attachable[0]?.fileId ?? ''],
    });

    await resolution.addDisputeStatement(BUYER, {
      disputeId: opened.disputeId,
      statement: 'Adding the inspection sheet reference for the twelve boards.',
      evidenceFileIds: [],
    });

    const view = await resolution.getDispute(BUYER, opened.disputeId);
    expect(view?.statements).toHaveLength(2);

    // IDEEZA resolves it; after that the record is closed.
    await prisma.dispute.update({
      where: { id: opened.disputeId },
      data: { status: 'resolved', outcome: 'partial_refund', resolvedAt: new Date() },
    });

    await expect(
      resolution.addDisputeStatement(BUYER, {
        disputeId: opened.disputeId,
        statement: 'One more thing.',
        evidenceFileIds: [],
      }),
    ).rejects.toThrow(InvariantViolationError);
  });

  it('allows one case per order', async () => {
    const orderId = await orderInState(314, 'delivered');
    const context = await resolution.getIssueContext(BUYER, orderId);
    const files = [context?.attachable[0]?.fileId ?? ''];

    await resolution.openDispute(BUYER, {
      orderId: String(orderId),
      reason: 'damaged_in_transit',
      claimedAmount: { amountMinor: 1_000, currency: 'USD' },
      statement: 'Two trays were crushed and the boards inside are bent.',
      evidenceFileIds: files,
    });

    await expect(
      resolution.openDispute(BUYER, {
        orderId: String(orderId),
        reason: 'damaged_in_transit',
        claimedAmount: { amountMinor: 1_000, currency: 'USD' },
        statement: 'Opening a second case about the same delivery.',
        evidenceFileIds: files,
      }),
    ).rejects.toThrow(InvariantViolationError);
  });

  it('shows another buyer nothing of the case', async () => {
    const orderId = await orderInState(315, 'delivered');
    const context = await resolution.getIssueContext(BUYER, orderId);
    const opened = await resolution.openDispute(BUYER, {
      orderId: String(orderId),
      reason: 'not_delivered',
      claimedAmount: { amountMinor: 1_000, currency: 'USD' },
      statement: 'The courier record says delivered, but nothing arrived here.',
      evidenceFileIds: [context?.attachable[0]?.fileId ?? ''],
    });

    expect(await resolution.getDispute(OTHER, opened.disputeId)).toBeNull();
  });

  it('carries the refund it grew out of', async () => {
    const orderId = await orderInState(316, 'delivered');
    const context = await resolution.getIssueContext(BUYER, orderId);
    const files = [context?.attachable[0]?.fileId ?? ''];

    const refund = await resolution.requestRefund(BUYER, {
      orderId: String(orderId),
      reason: 'defective_units',
      requestedAmount: { amountMinor: 3_000, currency: 'USD' },
      description: 'Nine boards failed the functional test on arrival.',
      evidenceFileIds: files,
    });

    const opened = await resolution.openDispute(BUYER, {
      orderId: String(orderId),
      reason: 'defective_units',
      claimedAmount: { amountMinor: 3_000, currency: 'USD' },
      statement: 'The manufacturer challenged the claim, so IDEEZA should decide it.',
      evidenceFileIds: files,
      refundId: refund.refundId,
    });

    const view = await resolution.getDispute(BUYER, opened.disputeId);
    expect(view?.refundId).toBe(refund.refundId);
  });
});
