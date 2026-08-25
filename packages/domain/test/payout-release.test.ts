import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  PAYOUT_RELEASE_TRIGGERS,
  applyTransition,
  isPayoutReleaseTrigger,
  payoutMachine,
  payoutReleaseBlockedReason,
  releasePayout,
} from '@ideeza/domain';
import { buildEvent, buildPayout, now } from './fixtures.js';

describe('payout release needs a documented order event', () => {
  it('lists exactly the sanctioned triggers', () => {
    expect(PAYOUT_RELEASE_TRIGGERS).toEqual([
      'order.delivery_confirmed',
      'order.review_window_expired',
      'inspection.evidence_accepted',
      'partial_refund.agreed',
      'dispute.resolved',
    ]);
  });

  it('releases against a delivery confirmation', () => {
    const released = releasePayout({
      payout: buildPayout(),
      triggerEvent: buildEvent('order.delivery_confirmed'),
      releasedAt: now,
    });

    expect(released.status).toBe('released');
    expect(released.releaseTriggerEventId).toBe('event_order.delivery_confirmed');
    expect(released.releasedAt).toBe(now);
  });

  it('refuses an event that is not a release trigger', () => {
    expect(isPayoutReleaseTrigger('order.shipped')).toBe(false);
    expect(() =>
      releasePayout({
        payout: buildPayout(),
        triggerEvent: buildEvent('order.shipped'),
        releasedAt: now,
      }),
    ).toThrow(InvariantViolationError);
  });

  it('refuses a release with no trigger event supplied at all', () => {
    expect(() =>
      applyTransition(payoutMachine, 'pending_release', 'released', {}),
    ).toThrow(/no documented order event/);
  });

  it('refuses a trigger recorded against a different order', () => {
    expect(() =>
      releasePayout({
        payout: buildPayout(),
        triggerEvent: buildEvent('order.delivery_confirmed', { orderId: 'order_other' }),
        releasedAt: now,
      }),
    ).toThrow(/different order/);
  });

  it('holds the payout while a dispute is open', () => {
    expect(() =>
      releasePayout({
        payout: buildPayout({ status: 'disputed' }),
        triggerEvent: buildEvent('dispute.resolved'),
        hasOpenDispute: true,
        releasedAt: now,
      }),
    ).toThrow(/open dispute/);
  });

  it('explains the block without throwing, for the operations queue', () => {
    expect(
      payoutReleaseBlockedReason({
        payout: buildPayout(),
        triggerEvent: buildEvent('order.shipped'),
      }),
    ).toMatch(/does not justify releasing money/);

    expect(
      payoutReleaseBlockedReason({
        payout: buildPayout(),
        triggerEvent: buildEvent('order.review_window_expired'),
      }),
    ).toBeUndefined();
  });
});
