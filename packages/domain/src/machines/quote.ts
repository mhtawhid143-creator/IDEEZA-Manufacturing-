import {
  QUOTE_STATUSES,
  SUBSTITUTION_STATUSES,
  type QuoteStatus,
  type SubstitutionStatus,
} from '../status/index.js';
import type { StateMachine, TransitionGuard } from './state-machine.js';

export interface QuoteTransitionContext {
  /** Number of quotes already accepted on the same request. */
  readonly acceptedQuoteCountOnRfq: number;
  /** Substitutions still waiting for a buyer decision. */
  readonly pendingSubstitutionCount: number;
}

const onlyOneAcceptedQuotePerRfq: TransitionGuard<QuoteStatus, QuoteTransitionContext> = (
  context,
) =>
  context.acceptedQuoteCountOnRfq > 0
    ? 'another quote on this request has already been accepted'
    : null;

const substitutionsMustBeDecided: TransitionGuard<QuoteStatus, QuoteTransitionContext> = (
  context,
) =>
  context.pendingSubstitutionCount > 0
    ? 'suggested replacement parts are still waiting for a buyer decision'
    : null;

export const quoteMachine: StateMachine<QuoteStatus, QuoteTransitionContext> = {
  name: 'Quote',
  initial: 'draft',
  states: QUOTE_STATUSES,
  transitions: {
    draft: ['submitted', 'withdrawn'],
    submitted: [
      'revision_requested',
      'accepted',
      'rejected',
      'expired',
      'withdrawn',
    ],
    revision_requested: ['revised', 'withdrawn', 'expired'],
    revised: ['revision_requested', 'accepted', 'rejected', 'expired', 'withdrawn'],
    accepted: [],
    rejected: [],
    expired: [],
    withdrawn: [],
  },
  terminal: ['accepted', 'rejected', 'expired', 'withdrawn'],
  guards: {
    accepted: [onlyOneAcceptedQuotePerRfq, substitutionsMustBeDecided],
  },
};

export const substitutionMachine: StateMachine<SubstitutionStatus, undefined> = {
  name: 'Substitution',
  initial: 'proposed',
  states: SUBSTITUTION_STATUSES,
  transitions: {
    proposed: ['approved', 'rejected'],
    approved: [],
    rejected: [],
  },
  terminal: ['approved', 'rejected'],
};
