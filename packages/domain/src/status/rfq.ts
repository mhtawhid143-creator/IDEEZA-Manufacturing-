/** Buyer-owned request for quotes. */
export const RFQ_STATUSES = ['draft', 'submitted', 'closed', 'withdrawn'] as const;
export type RfqStatus = (typeof RFQ_STATUSES)[number];

/**
 * One routing record per selected manufacturer. A single RFQ is routed to many
 * manufacturers, so per-manufacturer state lives here and never on the RFQ.
 */
export const RFQ_RECIPIENT_STATUSES = [
  'routed',
  'viewed',
  'quoted',
  'declined',
  'expired',
] as const;
export type RfqRecipientStatus = (typeof RFQ_RECIPIENT_STATUSES)[number];
