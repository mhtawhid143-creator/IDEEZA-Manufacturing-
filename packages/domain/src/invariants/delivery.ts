import { InvariantViolationError } from '../errors.js';
import type { OrderStatus } from '../status/index.js';

/**
 * Confirming delivery is what releases the money.
 *
 * It is one of the documented events a payout may be released against, so it is
 * the buyer's most consequential action after paying: it is only offered once
 * the units have actually arrived, and it is given once.
 */
const CONFIRMABLE_STATUSES: readonly OrderStatus[] = Object.freeze(['delivered']);

export const assertDeliveryConfirmable = (
  orderId: string,
  orderStatus: OrderStatus,
  deliveredAt: Date | null,
): void => {
  if (!CONFIRMABLE_STATUSES.includes(orderStatus)) {
    throw new InvariantViolationError(
      'delivery-not-confirmable',
      orderStatus === 'completed'
        ? `order "${orderId}" is already complete`
        : `an order that is "${orderStatus}" has not been delivered yet`,
    );
  }
  if (deliveredAt === null) {
    throw new InvariantViolationError(
      'delivery-not-confirmable',
      'the delivery has no recorded date, so there is nothing to confirm',
    );
  }
};

/**
 * How long the buyer has to inspect what arrived.
 *
 * The length is an open product decision: the business model names the window
 * and its consequence but not its duration, so the caller passes the number of
 * days and the platform states it on screen rather than hiding a default in the
 * domain.
 */
export const reviewWindowEnd = (deliveredAt: Date, days: number): Date => {
  if (!Number.isInteger(days) || days <= 0) {
    throw new InvariantViolationError(
      'review-window-length',
      'the review window is a whole number of days',
    );
  }
  return new Date(deliveredAt.getTime() + days * 24 * 60 * 60 * 1000);
};

export const isReviewWindowOpen = (endsAt: Date | null, now: Date): boolean =>
  endsAt !== null && endsAt.getTime() > now.getTime();

/** Whole days left, rounded up, so "1 day left" is not shown as zero. */
export const reviewWindowDaysLeft = (endsAt: Date | null, now: Date): number => {
  if (endsAt === null) return 0;
  const remaining = endsAt.getTime() - now.getTime();
  return remaining <= 0 ? 0 : Math.ceil(remaining / (24 * 60 * 60 * 1000));
};

/**
 * When the window closes with no word from the buyer, the money is released.
 *
 * The expiry is itself a documented event, which is why silence can release a
 * payout while an open issue cannot.
 */
export const assertWindowExpiryReleasable = (
  endsAt: Date | null,
  now: Date,
  hasOpenIssue: boolean,
): void => {
  if (isReviewWindowOpen(endsAt, now)) {
    throw new InvariantViolationError(
      'review-window-still-open',
      'the review window has not closed yet',
    );
  }
  if (hasOpenIssue) {
    throw new InvariantViolationError(
      'review-window-expiry-blocked',
      'an open refund request or dispute holds the money',
    );
  }
};

export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;

/**
 * A review is published against an order that was actually delivered.
 *
 * One order carries one review: a rating that could be revised, or added by
 * someone who never received the units, would say nothing about the
 * manufacturer.
 */
export const assertReviewPublishable = (input: {
  readonly orderStatus: OrderStatus;
  readonly deliveredAt: Date | null;
  readonly alreadyReviewed: boolean;
  readonly rating: number;
}): void => {
  if (input.deliveredAt === null) {
    throw new InvariantViolationError(
      'review-requires-delivery',
      'a review can only be left once the units have been delivered',
    );
  }
  if (input.orderStatus === 'cancelled' || input.orderStatus === 'refunded') {
    throw new InvariantViolationError(
      'review-requires-delivery',
      `an order that is "${input.orderStatus}" cannot be reviewed`,
    );
  }
  if (input.alreadyReviewed) {
    throw new InvariantViolationError(
      'review-already-published',
      'this order has already been reviewed',
    );
  }
  if (
    !Number.isInteger(input.rating) ||
    input.rating < REVIEW_RATING_MIN ||
    input.rating > REVIEW_RATING_MAX
  ) {
    throw new InvariantViolationError(
      'review-rating-range',
      `a rating is a whole number from ${REVIEW_RATING_MIN} to ${REVIEW_RATING_MAX}`,
    );
  }
};

/**
 * The manufacturer's public rating, recomputed from the reviews it has.
 *
 * Kept to two decimals because that is what the profile column holds, and
 * rounded rather than truncated so a 4.995 does not read as 4.99.
 */
export const averageRating = (ratings: readonly number[]): number | null => {
  if (ratings.length === 0) return null;
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return Math.round((total / ratings.length) * 100) / 100;
};
