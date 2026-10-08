import { DOMAIN_EVENT_KINDS, type DomainEventKind } from '../events/kinds.js';

/**
 * What each recorded action is called when a person reads it.
 *
 * The log stores machine names because two panels, a database column and a test
 * all read them. Every surface that shows the log has to translate, and while
 * that translation lived in a screen — a hand-written map with nothing checking
 * it against the kinds that exist — a kind added later fell straight through to
 * the reader as `refund_manufacturer_challenged` with its underscores knocked
 * out (UIUX-123). Twelve had.
 *
 * So the vocabulary is here, beside the list it has to cover, and
 * `activity-vocabulary.test.ts` fails the build if the two come apart.
 *
 * **Every line is past tense**, in the design's own shape: a noun and what
 * happened to it. A log is a record of moments, so "Part ran out" belongs in it
 * and "Part out of stock" — a standing state — does not.
 */
export const ACTIVITY_LABEL: Readonly<Record<DomainEventKind, string>> = Object.freeze({
  // request routing
  'rfq.submitted': 'Request received',
  'rfq.withdrawn': 'Request withdrawn',
  'rfq.recipient_viewed': 'Request opened',
  'rfq.recipient_declined': 'Request declined',
  'rfq.recipient_expired': 'Request expired',
  'rfq.clarification_requested': 'Clarification requested',

  // quoting
  'quote.submitted': 'Quote sent',
  'quote.revision_requested': 'Revision requested',
  'quote.revised': 'Quote revised',
  'quote.accepted': 'Quote accepted',
  'quote.rejected': 'Quote declined',
  'quote.expired': 'Quote expired',
  'quote.withdrawn': 'Quote withdrawn',

  // parts
  'substitution.suggested': 'Substitute suggested',
  'substitution.approved': 'Substitute approved',
  'substitution.rejected': 'Substitute declined',
  'substitution.unavailable': 'Part declared unavailable',

  // money in
  'payment.initiated': 'Payment started',
  'payment.secured': 'Payment secured',
  'payment.failed': 'Payment failed',

  // the order
  'order.created': 'Order created',
  'order.confirmed': 'Order confirmed',
  'order.production_started': 'Production started',
  'order.stage_advanced': 'Stage advanced',
  'order.task_updated': 'Task updated',
  'order.shipped': 'Shipment recorded',
  'order.delivered': 'Delivery recorded',
  'order.delivery_confirmed': 'Delivery confirmed',
  'order.review_window_expired': 'Review window closed',
  'order.completed': 'Order completed',
  'order.cancel_requested': 'Cancellation requested',
  'order.cancelled': 'Order cancelled',

  // when it goes wrong
  'refund.requested': 'Refund requested',
  'refund.manufacturer_approved': 'Refund agreed by the shop',
  'refund.manufacturer_challenged': 'Refund challenged',
  'refund.decided': 'Refund decided',
  'dispute.opened': 'Issue opened',
  'dispute.responded': 'Issue answered',
  'dispute.under_review': 'Issue taken up',
  'dispute.resolved': 'Issue resolved',
  'dispute.escalated': 'Issue escalated',
  'inspection.evidence_accepted': 'Inspection evidence accepted',
  'partial_refund.agreed': 'Partial refund agreed',

  // money out
  'payout.released': 'Payout released',
  'payout.withheld': 'Payout withheld',

  // the record
  'evidence.captured': 'Evidence recorded',
  'review.published': 'Review published',
});

/**
 * The domain writes `refund.manufacturer_challenged`; the database column
 * stores `refund_manufacturer_challenged`. Both spell the same action, and a
 * screen reading the wrong one is how the raw token reached the feed, so this
 * reader takes either.
 */
const BY_STORED_SPELLING: ReadonlyMap<string, string> = new Map(
  DOMAIN_EVENT_KINDS.map((kind) => [kind.replace(/\./g, '_'), ACTIVITY_LABEL[kind]]),
);

/**
 * A kind this list has never seen still reaches the reader — unreadable is
 * better than hidden, because a feed that silently drops lines is a feed nobody
 * can trust. It arrives as a sentence rather than as a stored token.
 */
export const activityLabel = (kind: string): string => {
  const known = BY_STORED_SPELLING.get(kind.replace(/\./g, '_'));
  if (known !== undefined) return known;

  const words = kind.replace(/[._]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
