import { describe, expect, it } from 'vitest';
import {
  CANCELLATION_REASONS,
  InvariantViolationError,
  applyTransition,
  assertCancellationAllowed,
  assertClaimHasRecord,
  assertClaimWithinPayment,
  assertDisputeOpenable,
  assertNoOpenCancellation,
  assertRefundRequestable,
  assertStatementAllowed,
  cancellationRoute,
  orderMachine,
} from '../src/index.js';

describe('which instrument fits an order', () => {
  it('lets the buyer withdraw an order nothing has been spent on', () => {
    expect(cancellationRoute('awaiting_payment')).toBe('withdraw');
    expect(assertCancellationAllowed('order_1', 'awaiting_payment')).toBe('withdraw');
  });

  it('turns cancelling a funded order into a request', () => {
    for (const status of ['confirmed', 'in_production', 'quality_check'] as const) {
      expect(cancellationRoute(status)).toBe('request');
    }
  });

  it('refuses cancelling once the units have shipped', () => {
    for (const status of ['shipped', 'delivered', 'completed'] as const) {
      expect(cancellationRoute(status)).toBe('refused');
      expect(() => assertCancellationAllowed('order_1', status)).toThrow(
        InvariantViolationError,
      );
    }
    expect(() => assertCancellationAllowed('order_1', 'shipped')).toThrow(
      /ask for a refund or open a dispute/,
    );
  });

  it('allows one open cancellation request', () => {
    expect(() => assertNoOpenCancellation('in_production')).not.toThrow();
    expect(() => assertNoOpenCancellation('cancel_requested')).toThrow(
      /already has a cancellation request/,
    );
  });

  it('names the reasons a buyer cancels for, not the quality reasons', () => {
    expect(CANCELLATION_REASONS).toContain('design_change');
    expect(CANCELLATION_REASONS).not.toContain('defective_units');
  });
});

describe('the state machine behind cancelling', () => {
  it('lets a buyer cancel their own unfunded order', () => {
    expect(
      applyTransition(orderMachine, 'awaiting_payment', 'cancelled', {
        actorRole: 'buyer',
      }),
    ).toBe('cancelled');
  });

  it('refuses a buyer cancelling a funded order outright', () => {
    expect(() =>
      applyTransition(orderMachine, 'cancel_requested', 'cancelled', {
        actorRole: 'buyer',
        paymentStatus: 'secured',
      }),
    ).toThrow(/only IDEEZA operations may cancel a funded order/);
  });

  it('still refuses a manufacturer, funded or not', () => {
    expect(() =>
      applyTransition(orderMachine, 'awaiting_payment', 'cancelled', {
        actorRole: 'manufacturer',
      }),
    ).toThrow(/only IDEEZA operations/);
  });
});

describe('asking for money back', () => {
  const base = {
    orderId: 'order_1',
    orderStatus: 'delivered' as const,
    paidMinor: 10_000,
    openRefundCount: 0,
  };

  it('needs something to have been paid', () => {
    expect(() => assertRefundRequestable(base)).not.toThrow();
    expect(() => assertRefundRequestable({ ...base, paidMinor: 0 })).toThrow(
      /nothing was paid/,
    );
  });

  it('is refused until something has been delivered', () => {
    // The order lifecycle only admits refund_requested from shipped onwards:
    // before that a problem is a cancellation request or a dispute.
    for (const status of [
      'awaiting_payment',
      'confirmed',
      'in_production',
      'quality_check',
      'ready_to_ship',
    ] as const) {
      expect(() => assertRefundRequestable({ ...base, orderStatus: status })).toThrow(
        InvariantViolationError,
      );
    }
    expect(() =>
      assertRefundRequestable({ ...base, orderStatus: 'in_production' }),
    ).toThrow(/nothing has been delivered yet/);
  });

  it('is still allowed after the money has been released', () => {
    expect(() =>
      assertRefundRequestable({ ...base, orderStatus: 'completed' }),
    ).not.toThrow();
    expect(() => assertRefundRequestable({ ...base, orderStatus: 'shipped' })).not.toThrow();
  });

  it('allows one claim at a time', () => {
    expect(() => assertRefundRequestable({ ...base, openRefundCount: 1 })).toThrow(
      /already being decided/,
    );
  });

  it('caps a claim at what was paid', () => {
    expect(() => assertClaimWithinPayment(5_000, 10_000)).not.toThrow();
    expect(() => assertClaimWithinPayment(10_001, 10_000)).toThrow(
      /larger than what was paid/,
    );
    expect(() => assertClaimWithinPayment(0, 10_000)).toThrow(/greater than zero/);
    expect(() => assertClaimWithinPayment(1.5, 10_000)).toThrow(/whole amount/);
  });

  it('insists a claim arrives with a statement and a record', () => {
    expect(() =>
      assertClaimHasRecord({ statementLength: 40, attachedRecordCount: 1 }),
    ).not.toThrow();
    expect(() =>
      assertClaimHasRecord({ statementLength: 5, attachedRecordCount: 1 }),
    ).toThrow(/at least a couple of sentences/);
    expect(() =>
      assertClaimHasRecord({ statementLength: 40, attachedRecordCount: 0 }),
    ).toThrow(/at least one record/);
  });
});

describe('disputing an order', () => {
  it('is available once there is something at stake', () => {
    expect(() =>
      assertDisputeOpenable({ orderStatus: 'delivered', openDisputeCount: 0 }),
    ).not.toThrow();
    expect(() =>
      assertDisputeOpenable({ orderStatus: 'refund_requested', openDisputeCount: 0 }),
    ).not.toThrow();
  });

  it('is not available before production, or once it is refunded', () => {
    for (const status of ['awaiting_payment', 'confirmed', 'refunded'] as const) {
      expect(() =>
        assertDisputeOpenable({ orderStatus: status, openDisputeCount: 0 }),
      ).toThrow(/nothing to dispute yet/);
    }
  });

  it('allows one case per order', () => {
    expect(() =>
      assertDisputeOpenable({ orderStatus: 'delivered', openDisputeCount: 1 }),
    ).toThrow(/already has a dispute/);
  });

  it('closes the record when the case is resolved', () => {
    expect(() => assertStatementAllowed('open')).not.toThrow();
    expect(() => assertStatementAllowed('under_review')).not.toThrow();
    expect(() => assertStatementAllowed('resolved')).toThrow(/record is closed/);
  });
});
