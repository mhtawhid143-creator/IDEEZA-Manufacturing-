import { describe, expect, it } from 'vitest';
import {
  InvalidTransitionError,
  InvariantViolationError,
  MANUFACTURER_CANCELLATION_PATH,
  ORDER_STATUS_AFTER_QUOTE_ACCEPTANCE,
  PermissionDeniedError,
  applyTransition,
  assertManufacturerMayNotTerminateOrder,
  assertOrderMayBeConfirmed,
  assertProductionMayStart,
  confirmOrderAfterFundingSecured,
  openOrderForAcceptedQuote,
  orderMachine,
  type OrderTransitionContext,
} from '@ideeza/domain';
import {
  address,
  buildOrder,
  buildQuote,
  buyerId,
  now,
  orderId,
  paymentId,
  requirements,
  rfqId,
} from './fixtures.js';

const buyerContext = (
  overrides: Partial<OrderTransitionContext> = {},
): OrderTransitionContext => ({
  actorRole: 'buyer',
  paymentStatus: 'secured',
  ...overrides,
});

const manufacturerContext = (
  overrides: Partial<OrderTransitionContext> = {},
): OrderTransitionContext => ({
  actorRole: 'manufacturer',
  paymentStatus: 'secured',
  ...overrides,
});

describe('accepted quote does not create a confirmed order', () => {
  it('opens the order in awaiting_payment', () => {
    const order = openOrderForAcceptedQuote({
      orderId,
      quote: buildQuote({ status: 'accepted' }),
      requirements: requirements(),
      approvedSubstitutionIds: [],
      buyerId,
      rfqId,
      deliveryAddress: address,
      capturedAt: now,
    });

    expect(ORDER_STATUS_AFTER_QUOTE_ACCEPTANCE).toBe('awaiting_payment');
    expect(order.status).toBe('awaiting_payment');
    expect(order.paymentId).toBeUndefined();
    expect(order.confirmedAt).toBeUndefined();
  });

  it('refuses to open an order from a quote that was never accepted', () => {
    expect(() =>
      openOrderForAcceptedQuote({
        orderId,
        quote: buildQuote({ status: 'submitted' }),
        requirements: requirements(),
        approvedSubstitutionIds: [],
        buyerId,
        rfqId,
        deliveryAddress: address,
        capturedAt: now,
      }),
    ).toThrow(InvariantViolationError);
  });
});

describe('order confirmation requires secured funding', () => {
  it('confirms once the platform holds the money', () => {
    const order = buildOrder();
    const confirmed = confirmOrderAfterFundingSecured({
      order,
      payment: { id: paymentId, status: 'secured' },
      confirmedAt: now,
      context: buyerContext(),
    });

    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.paymentId).toBe(paymentId);
  });

  it('refuses to confirm while the payment is only initiated', () => {
    expect(() =>
      assertOrderMayBeConfirmed({ id: paymentId, status: 'initiated' }),
    ).toThrow(InvariantViolationError);

    expect(() =>
      applyTransition(
        orderMachine,
        'awaiting_payment',
        'confirmed',
        buyerContext({ paymentStatus: 'initiated' }),
      ),
    ).toThrow(/funding is not secured/);
  });

  it('refuses to confirm when no payment exists at all', () => {
    expect(() => assertOrderMayBeConfirmed(undefined)).toThrow(InvariantViolationError);
  });
});

describe('production cannot start before funding is secured', () => {
  it('refuses to move an unfunded order into production', () => {
    expect(() =>
      applyTransition(
        orderMachine,
        'confirmed',
        'in_production',
        manufacturerContext({ paymentStatus: 'initiated' }),
      ),
    ).toThrow(InvalidTransitionError);
  });

  it('refuses production while the order is still awaiting payment', () => {
    expect(() =>
      assertProductionMayStart({
        orderStatus: 'awaiting_payment',
        paymentStatus: undefined,
      }),
    ).toThrow(InvariantViolationError);
  });

  it('allows production once funding is secured', () => {
    expect(() =>
      assertProductionMayStart({ orderStatus: 'confirmed', paymentStatus: 'secured' }),
    ).not.toThrow();
    expect(
      applyTransition(orderMachine, 'confirmed', 'in_production', manufacturerContext()),
    ).toBe('in_production');
  });
});

describe('order happy path', () => {
  it('walks confirmed to delivered through the machine', () => {
    const sequence = [
      ['awaiting_payment', 'confirmed'],
      ['confirmed', 'in_production'],
      ['in_production', 'quality_check'],
      ['quality_check', 'ready_to_ship'],
      ['ready_to_ship', 'shipped'],
      ['shipped', 'delivered'],
    ] as const;

    for (const [from, to] of sequence) {
      expect(applyTransition(orderMachine, from, to, manufacturerContext())).toBe(to);
    }
  });

  it('refuses to skip straight from confirmed to shipped', () => {
    expect(() =>
      applyTransition(orderMachine, 'confirmed', 'shipped', manufacturerContext()),
    ).toThrow(InvalidTransitionError);
  });

  it('completes only against a documented order event', () => {
    expect(() =>
      applyTransition(orderMachine, 'delivered', 'completed', buyerContext()),
    ).toThrow(/documented order event/);

    expect(
      applyTransition(
        orderMachine,
        'delivered',
        'completed',
        buyerContext({ recordedEventKinds: ['order.delivery_confirmed'] }),
      ),
    ).toBe('completed');
  });
});

describe('a manufacturer may never reject an order', () => {
  it('blocks a manufacturer-driven cancellation at the machine', () => {
    expect(() =>
      applyTransition(orderMachine, 'in_production', 'cancel_requested', manufacturerContext()),
    ).not.toThrow();

    expect(() =>
      applyTransition(
        orderMachine,
        'cancel_requested',
        'cancelled',
        manufacturerContext(),
      ),
    ).toThrow(/only IDEEZA operations may cancel/);
  });

  it('blocks a manufacturer from terminating an order by any route', () => {
    const actor = { role: 'manufacturer' as const, manufacturerId: undefined };
    for (const target of ['cancelled', 'refunded', 'partially_refunded', 'resolved'] as const) {
      expect(() => assertManufacturerMayNotTerminateOrder(actor, target)).toThrow(
        PermissionDeniedError,
      );
    }
  });

  it('leaves the cancellation request as the sanctioned manufacturer route', () => {
    expect(MANUFACTURER_CANCELLATION_PATH).toBe('cancel_requested');
    expect(() =>
      assertManufacturerMayNotTerminateOrder(
        { role: 'manufacturer', manufacturerId: undefined },
        'cancel_requested',
      ),
    ).not.toThrow();
  });

  it('lets operations cancel', () => {
    expect(
      applyTransition(orderMachine, 'cancel_requested', 'cancelled', {
        actorRole: 'ops_admin',
        paymentStatus: 'secured',
      }),
    ).toBe('cancelled');
  });
});
