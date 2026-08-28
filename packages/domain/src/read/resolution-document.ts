import type { DisputeOutcome, DisputeStatus, OrderIssueReason } from '../status/resolution.js';

/**
 * One claim, one case, read the same way by both panels.
 *
 * A refund claim and the dispute that may follow it are the two records where
 * the buyer and the shop are furthest apart and the stakes are highest: money is
 * held, and each side is writing an account that operations will weigh. Until
 * this file existed each panel spelled the same facts its own way — the buyer
 * read "Failed our quality check" where the shop read "failed_quality_check",
 * and the case the buyer called `dp_mtc9f2x1` the shop called `9F2X1ABC`. Two
 * names for one case is not a cosmetic problem: it is two people unable to tell
 * whether they are talking about the same thing.
 *
 * So the words and the reference live here, once, and both panels read them.
 */

/** What the buyer says went wrong. The list is the domain's; the words are for people. */
export const ORDER_ISSUE_REASON_LABEL: Readonly<Record<OrderIssueReason, string>> =
  Object.freeze({
    failed_quality_check: 'Failed the quality check',
    defective_units: 'Defective units',
    wrong_specification: 'Built to the wrong specification',
    wrong_quantity: 'Wrong quantity delivered',
    unapproved_substitution: 'A part was substituted without approval',
    late_delivery: 'Delivered late',
    damaged_in_transit: 'Damaged in transit',
    not_delivered: 'Never delivered',
    missing_documentation: 'Missing documentation',
  });

export const issueReasonLabel = (reason: OrderIssueReason | string): string =>
  ORDER_ISSUE_REASON_LABEL[reason as OrderIssueReason] ?? reason.replace(/_/g, ' ');

/**
 * What operations decided. Written from nobody's side: "Partial refund" reads
 * the same to the party paying it and the party receiving it.
 */
export const DISPUTE_OUTCOME_LABEL: Readonly<Record<DisputeOutcome, string>> =
  Object.freeze({
    no_issue_found: 'No issue found',
    rework: 'Rework by the manufacturer',
    partial_refund: 'Partial refund',
    full_refund: 'Full refund',
    replacement_shipment: 'Replacement shipment',
    cancelled_before_production: 'Cancelled before production',
    escalated_to_inspection: 'Escalated to an independent inspection',
  });

export const disputeOutcomeLabel = (outcome: DisputeOutcome | string | null): string =>
  outcome === null
    ? 'Not decided yet'
    : (DISPUTE_OUTCOME_LABEL[outcome as DisputeOutcome] ?? outcome.replace(/_/g, ' '));

/**
 * Where the case has got to. Deliberately not "pending": a case is either open,
 * answered, being decided, escalated or decided, and each of those tells the
 * reader something different about what happens next.
 */
export const DISPUTE_STATUS_LABEL: Readonly<Record<DisputeStatus, string>> = Object.freeze(
  {
    open: 'Open',
    responded: 'Answered',
    under_review: 'With IDEEZA',
    escalated: 'Escalated',
    resolved: 'Decided',
  },
);

export const disputeStatusLabel = (status: DisputeStatus | string): string =>
  DISPUTE_STATUS_LABEL[status as DisputeStatus] ?? status.replace(/_/g, ' ');

/**
 * Where the claim has got to. `mfr_responded` is the shop's answer, not a
 * decision, and the wording has to keep that distinction — a buyer who reads
 * "responded" as "settled" will stop watching a claim that is still open.
 */
export const REFUND_STATUS_LABEL: Readonly<Record<string, string>> = Object.freeze({
  requested: 'Waiting on the manufacturer',
  mfr_responded: 'Answered by the manufacturer',
  ops_review: 'With IDEEZA',
  approved: 'Approved in full',
  partial: 'Partly approved',
  rejected: 'Refused',
});

export const refundStatusLabel = (status: string): string =>
  REFUND_STATUS_LABEL[status] ?? status.replace(/_/g, ' ');

/**
 * The reference both sides quote at each other.
 *
 * A database id is not a reference a person can read down a phone line, and the
 * two panels were shortening it differently. This is the one form: a prefix that
 * says what kind of record it is, and the last eight characters of its id, which
 * are the part that differs between records.
 */
const reference = (prefix: string, id: string): string =>
  // Identifiers carry separators the reader does not need — an id like
  // `rfd_open_9f21` would otherwise read out as CLAIM-PEN_9F21. Only the
  // letters and digits go into a reference, which is what makes it quotable.
  `${prefix}-${id.replace(/[^0-9a-zA-Z]/g, '').slice(-8).toUpperCase()}`;

/** `CASE-1A2B3C4D` — a dispute, as quoted by either side. */
export const caseReference = (disputeId: string): string => reference('CASE', disputeId);

/** `CLAIM-1A2B3C4D` — a refund claim, as quoted by either side. */
export const claimReference = (refundId: string): string => reference('CLAIM', refundId);

/**
 * Who said it, from the reader's side.
 *
 * The same statement is "You" to its author and "The manufacturer" to the other
 * party, so the viewer is a parameter rather than a hard-coded assumption in
 * each panel. Operations is never "you" to either of them.
 */
export const statementAuthorLabel = (
  authorRole: string,
  viewer: 'buyer' | 'manufacturer',
): string => {
  if (authorRole === 'ops_admin') return 'IDEEZA operations';
  if (authorRole === viewer) return 'You';
  return authorRole === 'buyer' ? 'The buyer' : 'The manufacturer';
};

/**
 * What a shop may accept of a claim.
 *
 * The design lets a shop answer a claim in full or with an amount of its own —
 * which is an offer, not a settlement, because only operations moves money. The
 * bounds are the ones that make the offer meaningful: more than nothing, and no
 * more than what was claimed.
 */
export const assertAcceptableRefundAmount = (input: {
  readonly acceptedMinor: number;
  readonly claimedMinor: number;
}): void => {
  if (!Number.isInteger(input.acceptedMinor) || input.acceptedMinor <= 0) {
    throw new Error('Say what amount you accept, as a figure above zero.');
  }
  if (input.acceptedMinor > input.claimedMinor) {
    throw new Error(
      'You cannot accept more than the buyer claimed; that is not an answer to this claim.',
    );
  }
};
