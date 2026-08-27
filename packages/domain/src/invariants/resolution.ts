import { InvariantViolationError } from '../errors.js';
import type { OrderStatus } from '../status/index.js';

/**
 * Why a buyer asks to stop an order.
 *
 * The reasons a buyer cancels are commercial, and they are not the quality
 * reasons a refund uses: mixing the two lists would make both meaningless in a
 * dispute. The design has a reason dropdown with no list behind it, so this is
 * the list that fills it.
 */
export const CANCELLATION_REASONS = [
  'no_longer_needed',
  'design_change',
  'lead_time_too_long',
  'cost_too_high',
  'ordered_by_mistake',
  'found_another_supplier',
  'funding_withdrawn',
  'other',
] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

/**
 * Orders a buyer may still stop without anyone's agreement.
 *
 * Nothing has been made and no money has moved to the shop floor, so the buyer
 * may withdraw. Everything after this is a *request*, because material has been
 * bought and time has been spent.
 */
const CANCELLABLE_OUTRIGHT: readonly OrderStatus[] = Object.freeze([
  'awaiting_payment',
]);

/** Orders where a cancellation may be asked for, but not taken. */
const CANCELLATION_REQUESTABLE: readonly OrderStatus[] = Object.freeze([
  'confirmed',
  'in_production',
  'quality_check',
]);

export type CancellationRoute = 'withdraw' | 'request' | 'refused';

/**
 * Which cancellation route an order is on.
 *
 * This is the rule the design's single "Order Cancel Request" modal has to
 * respect: before funding it is the buyer's own decision, during production it
 * is a request IDEEZA decides, and once the units have shipped cancelling is not
 * the right instrument at all — a refund or a dispute is.
 */
export const cancellationRoute = (orderStatus: OrderStatus): CancellationRoute => {
  if (CANCELLABLE_OUTRIGHT.includes(orderStatus)) return 'withdraw';
  if (CANCELLATION_REQUESTABLE.includes(orderStatus)) return 'request';
  return 'refused';
};

export const assertCancellationAllowed = (
  orderId: string,
  orderStatus: OrderStatus,
): CancellationRoute => {
  const route = cancellationRoute(orderStatus);
  if (route === 'refused') {
    throw new InvariantViolationError(
      'cancellation-not-available',
      orderStatus === 'shipped' || orderStatus === 'delivered'
        ? `order "${orderId}" has already shipped; ask for a refund or open a dispute instead`
        : `an order that is "${orderStatus}" cannot be cancelled`,
    );
  }
  return route;
};

/** A buyer may hold one open cancellation request per order. */
export const assertNoOpenCancellation = (orderStatus: OrderStatus): void => {
  if (orderStatus === 'cancel_requested') {
    throw new InvariantViolationError(
      'cancellation-already-requested',
      'this order already has a cancellation request waiting on IDEEZA',
    );
  }
};

/**
 * Orders a refund may be asked for.
 *
 * A refund answers a problem with what was delivered, so it needs something
 * delivered to answer: before the units ship, a problem is a cancellation
 * request or a dispute, and the order lifecycle only admits refund_requested
 * from here. A claim is still allowed after the money has been released — a
 * defect can surface later — and IDEEZA then recovers it from the manufacturer
 * rather than from an escrow that is already empty.
 */
const REFUNDABLE_STATUSES: readonly OrderStatus[] = Object.freeze([
  'shipped',
  'delivered',
  'completed',
]);

export const assertRefundRequestable = (input: {
  readonly orderId: string;
  readonly orderStatus: OrderStatus;
  /** What the buyer actually paid, held or already released. */
  readonly paidMinor: number;
  readonly openRefundCount: number;
}): void => {
  if (input.paidMinor <= 0) {
    throw new InvariantViolationError(
      'refund-requires-payment',
      'nothing was paid on this order, so there is nothing to refund',
    );
  }
  if (!REFUNDABLE_STATUSES.includes(input.orderStatus)) {
    throw new InvariantViolationError(
      'refund-not-available',
      input.orderStatus === 'confirmed' ||
      input.orderStatus === 'in_production' ||
      input.orderStatus === 'quality_check' ||
      input.orderStatus === 'ready_to_ship'
        ? `nothing has been delivered yet; ask IDEEZA to cancel the order, or open a dispute about how it is being made`
        : `an order that is "${input.orderStatus}" cannot be refunded`,
    );
  }
  if (input.openRefundCount > 0) {
    throw new InvariantViolationError(
      'refund-already-requested',
      'a refund request on this order is already being decided',
    );
  }
};

/** A claim may never exceed what was actually paid for the order. */
export const assertClaimWithinPayment = (
  claimedMinor: number,
  paidMinor: number,
): void => {
  if (!Number.isInteger(claimedMinor) || claimedMinor <= 0) {
    throw new InvariantViolationError(
      'claim-amount',
      'a claim is a whole amount greater than zero',
    );
  }
  if (claimedMinor > paidMinor) {
    throw new InvariantViolationError(
      'claim-exceeds-payment',
      'a claim cannot be larger than what was paid for the order',
    );
  }
};

/**
 * A claim is decided on the record, so it arrives with one.
 *
 * The written statement is the substance; the attached records are what make it
 * checkable by someone who was not there.
 */
export const assertClaimHasRecord = (input: {
  readonly statementLength: number;
  readonly attachedRecordCount: number;
}): void => {
  if (input.statementLength < 20) {
    throw new InvariantViolationError(
      'claim-requires-statement',
      'say what went wrong in at least a couple of sentences',
    );
  }
  if (input.attachedRecordCount < 1) {
    throw new InvariantViolationError(
      'claim-requires-evidence',
      'attach at least one record from the order to support the claim',
    );
  }
};

/**
 * Orders a dispute may be opened on.
 *
 * A dispute is the instrument for a contested order, so it needs funding at
 * stake or a refund that was refused. It is never a second refund request: one
 * dispute per order at a time.
 */
const DISPUTABLE_STATUSES: readonly OrderStatus[] = Object.freeze([
  'in_production',
  'quality_check',
  'ready_to_ship',
  'shipped',
  'delivered',
  'completed',
  'refund_requested',
]);

export const assertDisputeOpenable = (input: {
  readonly orderStatus: OrderStatus;
  readonly openDisputeCount: number;
}): void => {
  if (!DISPUTABLE_STATUSES.includes(input.orderStatus)) {
    throw new InvariantViolationError(
      'dispute-not-available',
      `an order that is "${input.orderStatus}" has nothing to dispute yet`,
    );
  }
  if (input.openDisputeCount > 0) {
    throw new InvariantViolationError(
      'dispute-already-open',
      'this order already has a dispute in progress',
    );
  }
};

/** Statements are added while the case is live, and only by its parties. */
export const assertStatementAllowed = (disputeStatus: string): void => {
  if (disputeStatus === 'resolved') {
    throw new InvariantViolationError(
      'dispute-closed',
      'this dispute has been resolved; its record is closed',
    );
  }
};

/**
 * What the buyer is told will happen to the money.
 *
 * Both instruments hold the payout: that is the whole point of raising one, and
 * it is stated on screen rather than left to be discovered.
 */
export const HOLDS_PAYOUT = Object.freeze({
  refund_requested: true,
  disputed: true,
});
