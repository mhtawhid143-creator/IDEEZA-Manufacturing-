import type { QuoteStatus } from '../status/index.js';

/**
 * Where a request has got to, from the answering shop's side (UIUX-127).
 *
 * Six values, mutually exclusive, and every routed request is in exactly one of
 * them — which is what lets the counts above the inbox be checked against the
 * total rather than believed. The routing row alone could not do this: it says
 * whether the shop answered, and stays "quoted" whether the buyer then accepted
 * the quote or pulled the request entirely.
 *
 * Deliberately not here: clarification asked, revision requested, buyer
 * expiring. Those are reasons a "Quote sent" row needs attention, not places in
 * the lifecycle, and they are carried as a reason beside the status — the same
 * model the dashboard's action panel uses. Promoting them would fragment
 * "Quote sent" into near-duplicates and break the arithmetic.
 */
export const REQUEST_LIFECYCLE = [
  'new',
  'quoted',
  'accepted',
  'declined',
  'expired',
  'withdrawn',
] as const;

export type RequestLifecycle = (typeof REQUEST_LIFECYCLE)[number];

export const REQUEST_LIFECYCLE_LABEL: Readonly<Record<RequestLifecycle, string>> =
  Object.freeze({
    new: 'New RFQ',
    quoted: 'Quote sent',
    accepted: 'Accepted',
    declined: 'Declined',
    expired: 'Expired',
    withdrawn: 'Withdrawn',
  });

export interface RequestLifecycleInput {
  /** The routing row: what this shop did about the request. */
  readonly routing: 'routed' | 'viewed' | 'quoted' | 'declined' | 'expired';
  /** The request itself, which the buyer can withdraw under a shop. */
  readonly requestWithdrawn: boolean;
  /** The statuses of this shop's own quotes on the request. */
  readonly myQuoteStatuses: readonly QuoteStatus[];
}

/**
 * The one place the six are decided.
 *
 * Precedence reads as what a shop would want to know first. Winning the work
 * outranks everything. The shop's own closure — it declined, or its window
 * expired — outranks a later withdrawal, because the shop had already finished
 * with the request. A withdrawal only changes the reading of a request that was
 * still open.
 */
export const requestLifecycle = (input: RequestLifecycleInput): RequestLifecycle => {
  if (input.myQuoteStatuses.includes('accepted')) return 'accepted';
  if (input.routing === 'declined') return 'declined';
  if (input.routing === 'expired') return 'expired';
  if (input.requestWithdrawn) return 'withdrawn';
  if (input.routing === 'quoted') return 'quoted';
  return 'new';
};
