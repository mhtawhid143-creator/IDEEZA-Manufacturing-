/** Refund is the financial outcome; it always hangs off the order lifecycle. */
export const REFUND_STATUSES = [
  'requested',
  'mfr_responded',
  'ops_review',
  'approved',
  'partial',
  'rejected',
] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/** Dispute is the process that resolves a contested order. */
export const DISPUTE_STATUSES = [
  'open',
  'responded',
  'under_review',
  'resolved',
  'escalated',
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

/** Outcomes IDEEZA may record when resolving a dispute. */
export const DISPUTE_OUTCOMES = [
  'no_issue_found',
  'rework',
  'partial_refund',
  'full_refund',
  'replacement_shipment',
  'cancelled_before_production',
  'escalated_to_inspection',
] as const;
export type DisputeOutcome = (typeof DISPUTE_OUTCOMES)[number];

/**
 * Reasons a buyer may raise. Deliberately manufacturing-specific: the design
 * files still carry a service-marketplace list which must not be implemented.
 */
export const ORDER_ISSUE_REASONS = [
  'failed_quality_check',
  'defective_units',
  'wrong_specification',
  'wrong_quantity',
  'unapproved_substitution',
  'late_delivery',
  'damaged_in_transit',
  'not_delivered',
  'missing_documentation',
] as const;
export type OrderIssueReason = (typeof ORDER_ISSUE_REASONS)[number];

/** Reasons a manufacturer may decline an RFQ before any order exists. */
export const RFQ_DECLINE_REASONS = [
  'capability_mismatch',
  'capacity_unavailable',
  'below_minimum_order_quantity',
  'parts_unavailable',
  'lead_time_not_achievable',
  'files_incomplete',
  'destination_not_served',
  'other',
] as const;
export type RfqDeclineReason = (typeof RFQ_DECLINE_REASONS)[number];
