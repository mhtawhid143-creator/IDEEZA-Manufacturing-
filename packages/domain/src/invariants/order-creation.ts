import { InvariantViolationError } from '../errors.js';
import type { IsoTimestamp, OrderId, PaymentId } from '../ids.js';
import type { ManufacturingOrder } from '../entities/order.js';
import type { PostalAddress } from '../entities/party.js';
import type { Payment } from '../entities/settlement.js';
import type { Quote } from '../entities/quote.js';
import type { ManufacturingRequirements } from '../entities/product.js';
import type { OrderStatus, PaymentStatus } from '../status/index.js';
import { orderMachine, type OrderTransitionContext } from '../machines/order.js';
import { applyTransition } from '../machines/state-machine.js';
import { captureAcceptedQuoteSnapshot } from './snapshot.js';

/**
 * Accepting a quote never produces a confirmed order.
 *
 * The order opens in awaiting_payment, which is the state the buyer panel must
 * render instead of sending anyone to an order that does not exist yet.
 */
export const ORDER_STATUS_AFTER_QUOTE_ACCEPTANCE: OrderStatus = 'awaiting_payment';

export interface OpenOrderInput {
  readonly orderId: OrderId;
  readonly quote: Quote;
  readonly requirements: ManufacturingRequirements;
  readonly approvedSubstitutionIds: readonly string[];
  readonly buyerId: ManufacturingOrder['buyerId'];
  readonly rfqId: ManufacturingOrder['rfqId'];
  readonly deliveryAddress: PostalAddress;
  readonly capturedAt: IsoTimestamp;
}

/** Opens the unconfirmed order that an accepted quote is allowed to produce. */
export const openOrderForAcceptedQuote = (
  input: OpenOrderInput,
): ManufacturingOrder => {
  const acceptedQuote = captureAcceptedQuoteSnapshot({
    quote: input.quote,
    requirements: input.requirements,
    approvedSubstitutionIds: input.approvedSubstitutionIds,
    capturedAt: input.capturedAt,
  });

  return Object.freeze({
    id: input.orderId,
    rfqId: input.rfqId,
    buyerId: input.buyerId,
    manufacturerId: input.quote.manufacturerId,
    status: ORDER_STATUS_AFTER_QUOTE_ACCEPTANCE,
    acceptedQuote,
    paymentId: undefined,
    deliveryAddress: input.deliveryAddress,
    reviewWindowEndsAt: undefined,
    confirmedAt: undefined,
    deliveredAt: undefined,
    completedAt: undefined,
    createdAt: input.capturedAt,
  } satisfies ManufacturingOrder);
};

export const isFundingSecured = (status: PaymentStatus | undefined): boolean =>
  status === 'secured' || status === 'released' || status === 'partially_refunded';

/** An order is confirmed only once the platform holds the funds. */
export const assertOrderMayBeConfirmed = (
  payment: Pick<Payment, 'id' | 'status'> | undefined,
): void => {
  if (payment === undefined) {
    throw new InvariantViolationError(
      'order-confirmation-requires-secured-funding',
      'no payment is attached to this order',
    );
  }
  if (!isFundingSecured(payment.status)) {
    throw new InvariantViolationError(
      'order-confirmation-requires-secured-funding',
      `payment ${payment.id} is "${payment.status}", not secured`,
    );
  }
};

export interface ConfirmOrderInput {
  readonly order: ManufacturingOrder;
  readonly payment: Pick<Payment, 'id' | 'status'>;
  readonly confirmedAt: IsoTimestamp;
  readonly context: OrderTransitionContext;
}

/** Confirms an order after funding is secured, via the order state machine. */
export const confirmOrderAfterFundingSecured = (
  input: ConfirmOrderInput,
): ManufacturingOrder => {
  assertOrderMayBeConfirmed(input.payment);
  const status = applyTransition(
    orderMachine,
    input.order.status,
    'confirmed',
    input.context,
  );
  const paymentId: PaymentId = input.payment.id;
  return Object.freeze({
    ...input.order,
    status,
    paymentId,
    confirmedAt: input.confirmedAt,
  } satisfies ManufacturingOrder);
};
