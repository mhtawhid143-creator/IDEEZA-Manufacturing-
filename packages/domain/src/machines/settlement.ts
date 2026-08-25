import {
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  WITHDRAWAL_STATUSES,
  type PaymentStatus,
  type PayoutStatus,
  type WithdrawalStatus,
} from '../status/index.js';
import { isPayoutReleaseTrigger, type DomainEventKind } from '../events/kinds.js';
import type { StateMachine, TransitionGuard } from './state-machine.js';

export const paymentMachine: StateMachine<PaymentStatus, undefined> = {
  name: 'Payment',
  initial: 'initiated',
  states: PAYMENT_STATUSES,
  transitions: {
    initiated: ['secured', 'refunded'],
    secured: ['released', 'refunded', 'partially_refunded'],
    released: [],
    refunded: [],
    partially_refunded: ['released'],
  },
  terminal: ['released', 'refunded'],
};

export interface PayoutTransitionContext {
  /** The documented event that justifies releasing the money. */
  readonly releaseTriggerEventKind?: DomainEventKind | undefined;
  readonly releaseTriggerEventId?: string | undefined;
  readonly hasOpenDispute?: boolean | undefined;
}

/**
 * Money leaves the platform only against a documented order event, so the
 * release path demands both the event kind and the recorded event id.
 */
const requireDocumentedReleaseTrigger: TransitionGuard<
  PayoutStatus,
  PayoutTransitionContext
> = (context) => {
  if (context.hasOpenDispute === true) {
    return 'an open dispute holds the payout';
  }
  const kind = context.releaseTriggerEventKind;
  if (kind === undefined) {
    return 'no documented order event was supplied as the release trigger';
  }
  if (!isPayoutReleaseTrigger(kind)) {
    return `event "${kind}" is not a documented release trigger`;
  }
  if (context.releaseTriggerEventId === undefined || context.releaseTriggerEventId === '') {
    return 'the release trigger must reference a recorded event id';
  }
  return null;
};

export const payoutMachine: StateMachine<PayoutStatus, PayoutTransitionContext> = {
  name: 'Payout',
  initial: 'pending_release',
  states: PAYOUT_STATUSES,
  transitions: {
    pending_release: ['released', 'refunded', 'disputed'],
    released: [],
    refunded: [],
    disputed: ['released', 'refunded', 'pending_release'],
  },
  terminal: ['released', 'refunded'],
  guards: {
    released: [requireDocumentedReleaseTrigger],
  },
};

export const withdrawalMachine: StateMachine<WithdrawalStatus, undefined> = {
  name: 'WithdrawalRequest',
  initial: 'requested',
  states: WITHDRAWAL_STATUSES,
  transitions: {
    requested: ['paid', 'rejected'],
    paid: [],
    rejected: [],
  },
  terminal: ['paid', 'rejected'],
};
