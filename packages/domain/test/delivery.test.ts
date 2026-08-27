import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  assertDeliveryConfirmable,
  assertReviewPublishable,
  assertWindowExpiryReleasable,
  averageRating,
  isReviewWindowOpen,
  reviewWindowDaysLeft,
  reviewWindowEnd,
} from '../src/index.js';

const delivered = new Date('2026-06-01T00:00:00.000Z');

describe('confirming delivery', () => {
  it('is offered on a delivered order', () => {
    expect(() => assertDeliveryConfirmable('order_1', 'delivered', delivered)).not.toThrow();
  });

  it('is not offered before the units arrive', () => {
    for (const status of ['awaiting_payment', 'in_production', 'shipped'] as const) {
      expect(() => assertDeliveryConfirmable('order_1', status, null)).toThrow(
        InvariantViolationError,
      );
    }
  });

  it('is given once', () => {
    expect(() => assertDeliveryConfirmable('order_1', 'completed', delivered)).toThrow(
      /already complete/,
    );
  });

  it('refuses a delivered order with no delivery date', () => {
    expect(() => assertDeliveryConfirmable('order_1', 'delivered', null)).toThrow(
      /no recorded date/,
    );
  });
});

describe('the review window', () => {
  it('runs a whole number of days from delivery', () => {
    expect(reviewWindowEnd(delivered, 7).toISOString()).toBe('2026-06-08T00:00:00.000Z');
    expect(() => reviewWindowEnd(delivered, 0)).toThrow(InvariantViolationError);
    expect(() => reviewWindowEnd(delivered, 1.5)).toThrow(InvariantViolationError);
  });

  it('knows whether it is still open, and for how long', () => {
    const endsAt = reviewWindowEnd(delivered, 7);
    const day3 = new Date('2026-06-04T00:00:00.000Z');
    expect(isReviewWindowOpen(endsAt, day3)).toBe(true);
    expect(reviewWindowDaysLeft(endsAt, day3)).toBe(4);
    expect(isReviewWindowOpen(endsAt, new Date('2026-06-09T00:00:00.000Z'))).toBe(false);
    expect(reviewWindowDaysLeft(endsAt, new Date('2026-06-09T00:00:00.000Z'))).toBe(0);
    expect(reviewWindowDaysLeft(null, day3)).toBe(0);
  });

  it('rounds a part day up, so the last day is not shown as none', () => {
    const endsAt = reviewWindowEnd(delivered, 7);
    expect(reviewWindowDaysLeft(endsAt, new Date('2026-06-07T18:00:00.000Z'))).toBe(1);
  });

  it('releases the money on expiry, unless something is being contested', () => {
    const endsAt = reviewWindowEnd(delivered, 7);
    const after = new Date('2026-06-09T00:00:00.000Z');
    expect(() => assertWindowExpiryReleasable(endsAt, after, false)).not.toThrow();
    expect(() => assertWindowExpiryReleasable(endsAt, after, true)).toThrow(
      /open refund request or dispute/,
    );
    expect(() =>
      assertWindowExpiryReleasable(endsAt, new Date('2026-06-03T00:00:00.000Z'), false),
    ).toThrow(/has not closed/);
  });
});

describe('publishing a review', () => {
  const base = {
    orderStatus: 'completed' as const,
    deliveredAt: delivered,
    alreadyReviewed: false,
    rating: 4,
  };

  it('is allowed on a delivered order', () => {
    expect(() => assertReviewPublishable(base)).not.toThrow();
    expect(() => assertReviewPublishable({ ...base, orderStatus: 'delivered' })).not.toThrow();
  });

  it('needs a delivery', () => {
    expect(() => assertReviewPublishable({ ...base, deliveredAt: null })).toThrow(
      /once the units have been delivered/,
    );
  });

  it('is refused on a cancelled or refunded order', () => {
    for (const status of ['cancelled', 'refunded'] as const) {
      expect(() => assertReviewPublishable({ ...base, orderStatus: status })).toThrow(
        InvariantViolationError,
      );
    }
  });

  it('happens once per order', () => {
    expect(() => assertReviewPublishable({ ...base, alreadyReviewed: true })).toThrow(
      /already been reviewed/,
    );
  });

  it('takes a whole rating from one to five', () => {
    for (const rating of [0, 6, 3.5]) {
      expect(() => assertReviewPublishable({ ...base, rating })).toThrow(/whole number/);
    }
  });
});

describe('a manufacturer rating', () => {
  it('is the average of its reviews, to two decimals', () => {
    expect(averageRating([5, 4, 4])).toBe(4.33);
    expect(averageRating([5])).toBe(5);
    expect(averageRating([])).toBeNull();
  });
});
