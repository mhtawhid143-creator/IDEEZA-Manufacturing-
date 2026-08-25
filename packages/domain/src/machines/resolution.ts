import {
  DISPUTE_STATUSES,
  REFUND_STATUSES,
  type DisputeStatus,
  type RefundStatus,
} from '../status/index.js';
import type { ActorRole } from '../status/index.js';
import type { StateMachine, TransitionGuard } from './state-machine.js';

export interface ResolutionTransitionContext {
  readonly actorRole: ActorRole;
  /** Evidence attached to the case so far. */
  readonly evidenceCount?: number | undefined;
}

const onlyOperationsMayDecide: TransitionGuard<RefundStatus, ResolutionTransitionContext> = (
  context,
) =>
  context.actorRole === 'ops_admin'
    ? null
    : 'only IDEEZA operations may decide a refund';

export const refundMachine: StateMachine<RefundStatus, ResolutionTransitionContext> = {
  name: 'Refund',
  initial: 'requested',
  states: REFUND_STATUSES,
  transitions: {
    requested: ['mfr_responded', 'ops_review'],
    mfr_responded: ['ops_review', 'approved', 'partial', 'rejected'],
    ops_review: ['approved', 'partial', 'rejected'],
    approved: [],
    partial: [],
    rejected: [],
  },
  terminal: ['approved', 'partial', 'rejected'],
  guards: {
    approved: [onlyOperationsMayDecide],
    partial: [onlyOperationsMayDecide],
    rejected: [onlyOperationsMayDecide],
  },
};

const onlyOperationsMayResolve: TransitionGuard<
  DisputeStatus,
  ResolutionTransitionContext
> = (context) =>
  context.actorRole === 'ops_admin'
    ? null
    : 'only IDEEZA operations may resolve a dispute';

/** Decisions are made on the documented record, so evidence must exist. */
const requireEvidence: TransitionGuard<DisputeStatus, ResolutionTransitionContext> = (
  context,
) =>
  (context.evidenceCount ?? 0) > 0
    ? null
    : 'a dispute cannot be resolved without evidence on the record';

export const disputeMachine: StateMachine<DisputeStatus, ResolutionTransitionContext> = {
  name: 'Dispute',
  initial: 'open',
  states: DISPUTE_STATUSES,
  transitions: {
    open: ['responded', 'under_review', 'escalated'],
    responded: ['under_review', 'resolved', 'escalated'],
    under_review: ['resolved', 'escalated'],
    escalated: ['resolved'],
    resolved: [],
  },
  terminal: ['resolved'],
  guards: {
    resolved: [onlyOperationsMayResolve, requireEvidence],
  },
};
