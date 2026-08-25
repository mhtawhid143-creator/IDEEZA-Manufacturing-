/**
 * Structured business actions.
 *
 * Anything that changes what the two sides owe each other is one of these. The
 * list is closed on purpose: if an action is not here it cannot be recorded,
 * which is what prevents commitments from living only inside a conversation.
 */
export const DOMAIN_EVENT_KINDS = [
  // request routing
  'rfq.submitted',
  'rfq.withdrawn',
  'rfq.recipient_viewed',
  'rfq.recipient_declined',
  'rfq.recipient_expired',
  'rfq.clarification_requested',

  // quoting
  'quote.submitted',
  'quote.revision_requested',
  'quote.revised',
  'quote.accepted',
  'quote.rejected',
  'quote.expired',
  'quote.withdrawn',

  // substitutions
  'substitution.suggested',
  'substitution.approved',
  'substitution.rejected',

  // money in
  'payment.initiated',
  'payment.secured',
  'payment.failed',

  // order lifecycle
  'order.created',
  'order.confirmed',
  'order.production_started',
  'order.stage_advanced',
  'order.task_updated',
  'order.shipped',
  'order.delivered',
  'order.delivery_confirmed',
  'order.review_window_expired',
  'order.completed',
  'order.cancel_requested',
  'order.cancelled',

  // resolution
  'refund.requested',
  'refund.manufacturer_approved',
  'refund.manufacturer_challenged',
  'refund.decided',
  'dispute.opened',
  'dispute.responded',
  'dispute.under_review',
  'dispute.resolved',
  'dispute.escalated',
  'inspection.evidence_accepted',
  'partial_refund.agreed',

  // money out
  'payout.released',
  'payout.withheld',

  // record keeping
  'evidence.captured',
  'review.published',
] as const;
export type DomainEventKind = (typeof DOMAIN_EVENT_KINDS)[number];

/** Business objects an event can be about. */
export const EVENT_SUBJECT_KINDS = [
  'rfq',
  'rfq_recipient',
  'quote',
  'substitution',
  'payment',
  'order',
  'production_stage',
  'production_task',
  'refund',
  'dispute',
  'payout',
  'evidence',
  'review',
] as const;
export type EventSubjectKind = (typeof EVENT_SUBJECT_KINDS)[number];

/**
 * The only events that may release money to a manufacturer.
 *
 * Release is tied to documented order events, never to informal judgement.
 */
export const PAYOUT_RELEASE_TRIGGERS = [
  'order.delivery_confirmed',
  'order.review_window_expired',
  'inspection.evidence_accepted',
  'partial_refund.agreed',
  'dispute.resolved',
] as const satisfies readonly DomainEventKind[];
export type PayoutReleaseTrigger = (typeof PAYOUT_RELEASE_TRIGGERS)[number];

export const isPayoutReleaseTrigger = (
  kind: DomainEventKind,
): kind is PayoutReleaseTrigger =>
  (PAYOUT_RELEASE_TRIGGERS as readonly DomainEventKind[]).includes(kind);
