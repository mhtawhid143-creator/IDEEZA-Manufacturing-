import type { QuoteStatus } from '../status/index.js';

/**
 * Where a quote this shop sent has got to (UIUX-177).
 *
 * Five values, and the request's own six are deliberately not reused wholesale:
 * "New RFQ" cannot describe a quote, because a quote does not exist until it is
 * written. The other five line up one for one with `requestLifecycle`, so the
 * two pages speak one vocabulary without pretending a quote can be in a state
 * only a request can reach.
 *
 * `revision_requested` and `revised` are not here on purpose. A quote the buyer
 * has asked to see again is still a quote with the buyer; promoting it would
 * split "Quoted" into near-duplicates and break the arithmetic the counts above
 * the table depend on. It rides beside the pill as a reason instead — the same
 * model the dashboard's action panel uses.
 */
export const QUOTE_LIFECYCLE = [
  'quoted',
  'accepted',
  'declined',
  'expired',
  'withdrawn',
] as const;

export type QuoteLifecycle = (typeof QUOTE_LIFECYCLE)[number];

/**
 * What each is called.
 *
 * `declined` says who declined. On the request side the same word means *this
 * shop* turned the work down; here it means the *buyer* turned the price down.
 * One word for two actors' decisions would be worse than a longer label, so the
 * actor is named and the vocabulary still reads as one.
 */
export const QUOTE_LIFECYCLE_LABEL: Readonly<Record<QuoteLifecycle, string>> = Object.freeze(
  {
    quoted: 'Quoted',
    accepted: 'Accepted',
    declined: 'Declined by the buyer',
    expired: 'Expired',
    withdrawn: 'Withdrawn',
  },
);

/** The tone each carries. Colour says urgency and outcome, never work type. */
export const QUOTE_LIFECYCLE_TONE: Readonly<
  Record<QuoteLifecycle, 'brand' | 'success' | 'neutral' | 'warning'>
> = Object.freeze({
  quoted: 'brand',
  accepted: 'success',
  declined: 'neutral',
  expired: 'neutral',
  withdrawn: 'neutral',
});

export interface QuoteLifecycleInput {
  readonly status: QuoteStatus;
  /** Whether the clock has run out, which is a fact rather than a stored status. */
  readonly expired: boolean;
}

/**
 * The one place a quote's displayed state is decided.
 *
 * Expiry outranks "quoted" because a price nobody can accept any more is not
 * open, however the row is stored — but it never outranks an acceptance: a
 * quote that was accepted stays accepted after its validity date, since the
 * order it opened does not expire with it.
 */
export const quoteLifecycle = (input: QuoteLifecycleInput): QuoteLifecycle => {
  if (input.status === 'accepted') return 'accepted';
  if (input.status === 'rejected') return 'declined';
  if (input.status === 'withdrawn') return 'withdrawn';
  if (input.status === 'expired' || input.expired) return 'expired';
  return 'quoted';
};

/**
 * Why a quoted row needs this shop's attention, if it does (UIUX-179).
 *
 * Aggregated into the "Requiring action" count above the table and shown as a
 * chip on the row. Never a status: see the note on `QUOTE_LIFECYCLE`.
 */
export type QuoteReason = 'revision' | 'expiring';

export const QUOTE_REASON_LABEL: Readonly<Record<QuoteReason, string>> = Object.freeze({
  revision: 'Revision asked for',
  expiring: 'Expiring',
});

/** Days inside which an open quote is called expiring, on every surface. */
export const QUOTE_EXPIRING_WITHIN_DAYS = 3;

export const quoteReason = (input: {
  readonly status: QuoteStatus;
  readonly expiresAt: Date;
  readonly expired: boolean;
  readonly now: Date;
}): QuoteReason | null => {
  if (input.status === 'revision_requested') return 'revision';
  if (input.status !== 'submitted' && input.status !== 'revised') return null;
  if (input.expired) return null;
  const daysLeft = (input.expiresAt.getTime() - input.now.getTime()) / 86_400_000;
  return daysLeft <= QUOTE_EXPIRING_WITHIN_DAYS ? 'expiring' : null;
};
