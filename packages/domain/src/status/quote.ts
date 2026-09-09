/** Manufacturer response to an RFQ. Never a free-text chat commitment. */
export const QUOTE_STATUSES = [
  'draft',
  'submitted',
  'revision_requested',
  'revised',
  'accepted',
  'rejected',
  'expired',
  'withdrawn',
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/**
 * Manufacturer-suggested replacement for a part the buyer specified.
 *
 * `unavailable` is not a suggestion: it is the shop saying, in a form the
 * platform can read, that this line cannot be covered at all and that no
 * substitute exists for it. It is recorded rather than left blank because a
 * blank row and a line nobody looked at are the same absence, and only one of
 * them is an answer. The buyer does not approve or reject it — there is nothing
 * to decide on the line itself — so it is terminal the moment it is written and
 * never holds up acceptance of the quote it travels with.
 */
export const SUBSTITUTION_STATUSES = [
  'proposed',
  'approved',
  'rejected',
  'unavailable',
] as const;
export type SubstitutionStatus = (typeof SUBSTITUTION_STATUSES)[number];
