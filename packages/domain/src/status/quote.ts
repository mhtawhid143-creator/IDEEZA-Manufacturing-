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

/** Manufacturer-suggested replacement for a part the buyer specified. */
export const SUBSTITUTION_STATUSES = ['proposed', 'approved', 'rejected'] as const;
export type SubstitutionStatus = (typeof SUBSTITUTION_STATUSES)[number];
