import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { InvariantViolationError, asId, type OrderId, type UserId } from '@ideeza/domain';
import type { SaveDraftInput, SendRequestInput } from '@ideeza/types';
import type * as CheckoutData from '../src/data/checkout.js';
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

const BUYER = asId<UserId>('seed_user_buyer');
const MANUFACTURER = 'seed_mfr_a';

const draftInput = (overrides: Partial<SaveDraftInput> = {}): SaveDraftInput => ({
  productId: 'seed_product_fpv_stack',
  kind: 'pcb',
  includedFileIds: ['seed_file_stack_gerber'],
  includedBomLineIds: ['seed_bom_stack_u1'],
  quantity: 100,
  material: 'FR-4 TG150',
  manufacturingMethod: 'PCB fabrication + SMT assembly',
  tolerance: '+/-0.15mm',
  leadTimeDays: 21,
  shippingRequirement: 'Courier, tracked',
  assembly: 'smt',
  qualityCheckRequirement: 'AOI on 100%',
  substitutionPolicy: 'with_approval',
  deliveryAddress: { line1: '20/3, Sector 9', city: 'Dhaka', countryCode: 'BD' },
  ...overrides,
});

const sendInput = (rfqId: string): SendRequestInput => ({
  rfqId,
  requestedServices: ['pcb_fabrication', 'pcb_assembly'],
  manufacturerIds: [MANUFACTURER],
  quantity: 100,
  assembly: 'smt',
  volumeTiers: [],
  deliveryAddress: { line1: '20/3, Sector 9', city: 'Dhaka', countryCode: 'BD' },
});

/** Walks a product all the way to an order that is awaiting payment. */
const orderAwaitingPayment = async (quantity: number): Promise<OrderId> => {
  const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity }));
  await requests.submitRequest(BUYER, { ...sendInput(rfqId), quantity });

  const quoteId = `quote_${quantity}`;
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
      toolingSetupCostMinor: 12_000n,
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

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  drafts = await import('../src/data/drafts.js');
  requests = await import('../src/data/requests.js');
  quotes = await import('../src/data/quotes.js');
  checkout = await import('../src/data/checkout.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('the secured checkout', () => {
  it('prices the order from the accepted quote, not from the request', async () => {
    const orderId = await orderAwaitingPayment(100);
    const view = await checkout.getCheckout(BUYER, orderId);

    expect(view?.goodsMinor).toBe(50_000);
    expect(view?.toolingMinor).toBe(12_000);
    expect(view?.quotedShippingMinor).toBe(8_400);
    expect(view?.platformFeeMinor).toBe(1_500);
    expect(view?.totalMinor).toBe(50_000 + 12_000 + 8_400 + 1_500);
    expect(view?.leadTimeDays).toBe(18);
    expect(view?.status).toBe('awaiting_payment');
  });

  it('charges more for express shipping', async () => {
    const orderId = await orderAwaitingPayment(101);
    const standard = await checkout.getCheckout(BUYER, orderId, {
      shippingChoice: 'standard',
    });
    const express = await checkout.getCheckout(BUYER, orderId, {
      shippingChoice: 'express',
    });

    expect((express?.totalMinor ?? 0) - (standard?.totalMinor ?? 0)).toBe(
      checkout.EXPRESS_SURCHARGE_MINOR,
    );
  });

  it('reads the seeded coupon and takes it off the goods', async () => {
    const orderId = await orderAwaitingPayment(102);
    const read = await checkout.readPromoForOrder(BUYER, orderId, 'ideeza10');

    expect(read.usable).toBe(true);
    // 10% of the goods plus tooling.
    expect(read.discountMinor).toBe(Math.floor((500 * 102 + 12_000) / 10));
  });

  it('says why a coupon cannot be used', async () => {
    const orderId = await orderAwaitingPayment(103);
    const read = await checkout.readPromoForOrder(BUYER, orderId, 'NOPE');
    expect(read.usable).toBe(false);
    expect(read.refusal).toBe('unknown');
  });

  it('pays the order, which secures the funds and confirms it', async () => {
    const orderId = await orderAwaitingPayment(104);
    const result = await checkout.payOrder(BUYER, {
      orderId,
      method: 'paypal',
      shippingChoice: 'standard',
      acceptTerms: true,
    });

    expect(result.paid).toBe(true);

    const order = await prisma.manufacturingOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { payment: true, stages: true, payouts: true },
    });
    expect(order.status).toBe('confirmed');
    expect(order.confirmedAt).not.toBeNull();
    expect(order.payment?.status).toBe('secured');
    expect(order.payment?.securedAt).not.toBeNull();

    // The money held has a destination from the moment it is held: one payout,
    // for this manufacturer, against this payment, waiting for a release event.
    expect(order.payouts).toHaveLength(1);
    const payout = order.payouts[0]!;
    expect(payout.status).toBe('pending_release');
    expect(payout.manufacturerId).toBe(order.manufacturerId);
    expect(payout.paymentId).toBe(order.payment?.id);
    expect(payout.currency).toBe(order.payment?.currency);
    expect(payout.platformFeeMinor).toBe(order.payment?.platformFeeMinor);
    expect(payout.netAmountMinor).toBe(payout.orderAmountMinor - payout.platformFeeMinor);
    expect(payout.orderAmountMinor).toBe(
      (order.payment?.goodsAmountMinor ?? 0n) + (order.payment?.shippingAmountMinor ?? 0n),
    );

    // Production can be tracked from here: the ten canonical stages exist, and
    // the two that are already true are complete.
    expect(order.stages).toHaveLength(10);
    expect(
      order.stages.filter((stage) => stage.status === 'completed').map((stage) => stage.key).sort(),
    ).toEqual(['payment_secured', 'quote_accepted']);

    const events = await prisma.domainEvent.findMany({ where: { orderId } });
    expect(events.map((event) => event.kind)).toContain('payment_secured');
    expect(events.map((event) => event.kind)).toContain('order_confirmed');
  });

  it('records a coupon redemption on the payment', async () => {
    const orderId = await orderAwaitingPayment(105);
    await checkout.payOrder(BUYER, {
      orderId,
      method: 'bank',
      shippingChoice: 'standard',
      promoCode: 'IDEEZA10',
      acceptTerms: true,
    });

    const payment = await prisma.payment.findFirstOrThrow({
      where: { order: { id: orderId } },
      include: { promoCode: true },
    });
    expect(Number(payment.discountAmountMinor)).toBeGreaterThan(0);
    expect(payment.promoCode?.code).toBe('IDEEZA10');
    expect(payment.promoCode?.redeemedCount).toBeGreaterThan(0);
  });

  it('refuses a card that fails its own checks, and confirms nothing', async () => {
    const orderId = await orderAwaitingPayment(106);
    const result = await checkout.payOrder(BUYER, {
      orderId,
      method: 'card',
      shippingChoice: 'standard',
      cardName: 'A Buyer',
      cardNumber: '4242 4242 4242 4241',
      cardExpiry: '04/30',
      cardCvc: '123',
      acceptTerms: true,
    });

    expect(result.paid).toBe(false);
    expect(result.failureReason).toMatch(/checksum/);

    const order = await prisma.manufacturingOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { payment: true, stages: true },
    });
    expect(order.status).toBe('awaiting_payment');
    expect(order.payment).toBeNull();
    expect(order.stages).toHaveLength(0);
  });

  it('takes a card that passes its checks', async () => {
    const orderId = await orderAwaitingPayment(107);
    const result = await checkout.payOrder(BUYER, {
      orderId,
      method: 'card',
      shippingChoice: 'express',
      cardName: 'A Buyer',
      cardNumber: '4242 4242 4242 4242',
      cardExpiry: '04/30',
      cardCvc: '123',
      acceptTerms: true,
    });
    expect(result.paid).toBe(true);
  });

  it('refuses to pay the same order twice', async () => {
    const orderId = await orderAwaitingPayment(108);
    await checkout.payOrder(BUYER, {
      orderId,
      method: 'paypal',
      shippingChoice: 'standard',
      acceptTerms: true,
    });

    await expect(
      checkout.payOrder(BUYER, {
        orderId,
        method: 'paypal',
        shippingChoice: 'standard',
        acceptTerms: true,
      }),
    ).rejects.toThrow(InvariantViolationError);
  });

  it('refuses to pay another buyer’s order', async () => {
    const orderId = await orderAwaitingPayment(109);
    await expect(
      checkout.payOrder(asId<UserId>('seed_user_creator_a'), {
        orderId,
        method: 'paypal',
        shippingChoice: 'standard',
        acceptTerms: true,
      }),
    ).rejects.toThrow(/does not exist/);
  });

  it('keeps the delivery address changeable while the order is unpaid', async () => {
    const orderId = await orderAwaitingPayment(110);
    await checkout.setCheckoutAddress(
      BUYER,
      orderId,
      { line1: '9 New Street', city: 'Chattogram', countryCode: 'bd' },
      false,
    );

    const view = await checkout.getCheckout(BUYER, orderId);
    expect(view?.deliveryAddress.city).toBe('Chattogram');
    expect(view?.deliveryAddress.countryCode).toBe('BD');
  });

  it('refuses an address change once the funds are held', async () => {
    const orderId = await orderAwaitingPayment(111);
    await checkout.payOrder(BUYER, {
      orderId,
      method: 'paypal',
      shippingChoice: 'standard',
      acceptTerms: true,
    });

    await expect(
      checkout.setCheckoutAddress(
        BUYER,
        orderId,
        { line1: '9 New Street', city: 'Chattogram', countryCode: 'BD' },
        false,
      ),
    ).rejects.toThrow(InvariantViolationError);
  });
});
