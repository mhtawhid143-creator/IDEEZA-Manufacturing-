import { InvariantViolationError } from '../errors.js';
import type { QuoteId } from '../ids.js';
import type { QuoteStatus } from '../status/index.js';

export interface QuoteAcceptanceCandidate {
  readonly id: QuoteId;
  readonly status: QuoteStatus;
}

/**
 * A request may collect many responses, but exactly one of them can ever be
 * accepted. Every other response simply loses.
 */
export const assertSingleAcceptedQuote = (
  quotesOnRfq: readonly QuoteAcceptanceCandidate[],
  candidateId: QuoteId,
): void => {
  const alreadyAccepted = quotesOnRfq.filter(
    (quote) => quote.status === 'accepted' && quote.id !== candidateId,
  );
  if (alreadyAccepted.length > 0) {
    throw new InvariantViolationError(
      'single-accepted-quote',
      `quote ${alreadyAccepted[0]?.id ?? 'unknown'} on this request is already accepted`,
    );
  }
};

export const acceptedQuoteCountOnRfq = (
  quotesOnRfq: readonly QuoteAcceptanceCandidate[],
  candidateId: QuoteId,
): number =>
  quotesOnRfq.filter((quote) => quote.status === 'accepted' && quote.id !== candidateId)
    .length;

/** Substitutions still awaiting a buyer decision block acceptance. */
export const assertSubstitutionsDecided = (pendingSubstitutionCount: number): void => {
  if (pendingSubstitutionCount > 0) {
    throw new InvariantViolationError(
      'substitutions-decided-before-acceptance',
      `${pendingSubstitutionCount} suggested replacement part(s) still need a buyer decision`,
    );
  }
};
