import {
  ORDER_STATUSES,
  type ActorRole,
  type OrderStatus,
  type PaymentStatus,
} from '../status/index.js';
import { isPayoutReleaseTrigger, type DomainEventKind } from '../events/kinds.js';
import type { StateMachine, TransitionGuard } from './state-machine.js';

export interface OrderTransitionContext {
  /** Funding state of the payment attached to this order, if any. */
  readonly paymentStatus?: PaymentStatus | undefined;
  /** Who is asking for the change. */
  readonly actorRole: ActorRole;
  /** Documented events already recorded against this order. */
  readonly recordedEventKinds?: readonly DomainEventKind[] | undefined;
}

const fundingSecured = (context: OrderTransitionContext): boolean =>
  context.paymentStatus === 'secured' ||
  context.paymentStatus === 'released' ||
  context.paymentStatus === 'partially_refunded';

const requireSecuredFunding: TransitionGuard<OrderStatus, OrderTransitionContext> = (
  context,
) =>
  fundingSecured(context)
    ? null
    : 'funding is not secured by the platform yet';

const requireDocumentedCompletion: TransitionGuard<OrderStatus, OrderTransitionContext> = (
  context,
) => {
  const recorded = context.recordedEventKinds ?? [];
  const hasDocumentedBasis = recorded.some(
    (kind) => isPayoutReleaseTrigger(kind) || kind === 'order.delivered',
  );
  return hasDocumentedBasis
    ? null
    : 'completion requires a documented order event (delivery confirmation, review window expiry, accepted inspection evidence or a resolved dispute)';
};

/**
 * Only IDEEZA operations may cancel a live order.
 *
 * "Live" means funded: from the moment the platform holds the money, material
 * can be bought and time can be spent, so ending the order is a decision with
 * two sides to it. Before that, the buyer may withdraw their own unfunded order
 * outright — nothing has been made and nobody is out of pocket.
 *
 * A manufacturer is never on either path: it raises a cancellation request or a
 * dispute, and can never reject or cancel an order on its own.
 */
const onlyOperationsMayCancel: TransitionGuard<OrderStatus, OrderTransitionContext> = (
  context,
) => {
  if (context.actorRole === 'ops_admin') return null;
  if (context.actorRole === 'buyer' && !fundingSecured(context)) return null;
  return 'only IDEEZA operations may cancel a funded order; raise a cancellation request instead';
};

const onlyBuyerOrOperationsMayRaiseIssue: TransitionGuard<
  OrderStatus,
  OrderTransitionContext
> = (context) =>
  context.actorRole === 'buyer' || context.actorRole === 'ops_admin'
    ? null
    : 'a refund request is raised by the buyer';

/**
 * The outcomes of a refund or a dispute are operations' decisions.
 *
 * A buyer raises the issue and a manufacturer answers it, but the order only
 * ends in `refunded`, `partially_refunded` or `resolved` because IDEEZA
 * operations decided so — the permission matrix says as much, and the machine
 * says it here so no data layer can reach those states with another actor.
 */
const onlyOperationsMayDecide: TransitionGuard<OrderStatus, OrderTransitionContext> = (
  context,
) =>
  context.actorRole === 'ops_admin'
    ? null
    : 'only IDEEZA operations may decide a refund or resolve a dispute';

export const orderMachine: StateMachine<OrderStatus, OrderTransitionContext> = {
  name: 'ManufacturingOrder',
  initial: 'awaiting_payment',
  states: ORDER_STATUSES,
  transitions: {
    awaiting_payment: ['confirmed', 'cancel_requested', 'cancelled'],
    confirmed: ['in_production', 'cancel_requested'],
    in_production: ['quality_check', 'cancel_requested', 'disputed'],
    quality_check: ['ready_to_ship', 'in_production', 'disputed'],
    ready_to_ship: ['shipped', 'disputed'],
    shipped: ['delivered', 'refund_requested', 'disputed'],
    delivered: ['completed', 'refund_requested', 'disputed'],
    completed: ['refund_requested', 'disputed'],
    cancel_requested: ['cancelled', 'confirmed', 'in_production'],
    cancelled: [],
    refund_requested: ['refunded', 'partially_refunded', 'disputed', 'resolved'],
    refunded: [],
    partially_refunded: ['resolved', 'completed'],
    disputed: ['resolved', 'refunded', 'partially_refunded'],
    resolved: ['completed'],
  },
  terminal: ['cancelled', 'refunded'],
  guards: {
    confirmed: [requireSecuredFunding],
    in_production: [requireSecuredFunding],
    quality_check: [requireSecuredFunding],
    ready_to_ship: [requireSecuredFunding],
    shipped: [requireSecuredFunding],
    delivered: [requireSecuredFunding],
    completed: [requireDocumentedCompletion],
    cancelled: [onlyOperationsMayCancel],
    refund_requested: [onlyBuyerOrOperationsMayRaiseIssue],
    refunded: [onlyOperationsMayDecide],
    partially_refunded: [onlyOperationsMayDecide],
    resolved: [onlyOperationsMayDecide],
  },
};
