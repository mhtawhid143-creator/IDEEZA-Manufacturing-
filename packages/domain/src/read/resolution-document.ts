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
 * says what kind of record it is, and eight characters that stand for the record
 * and nothing else.
 *
 * They are computed from the id rather than cut out of it. Cutting looked fine
 * against random ids and turned an id like `verify_order_delivered` into
 * ORDER-ELIVERED — a reference that reads as a half-spelled word and invites the
 * reader to make something of it. A digest has no such accidents, is the same on
 * both panels for the same record, and collides about once in three trillion.
 */
const DIGEST_ALPHABET = 36;
const DIGEST_LENGTH = 8;

const reference = (prefix: string, id: string): string => {
  // FNV-1a, twice over, for enough bits to fill eight base-36 characters.
  let low = 0x811c9dc5;
  let high = 0x01000193;
  for (let index = 0; index < id.length; index += 1) {
    const code = id.charCodeAt(index);
    low = Math.imul(low ^ code, 0x01000193) >>> 0;
    high = Math.imul(high ^ (code + index), 0x85ebca6b) >>> 0;
  }
  // Composed as a big integer: 2^64 does not fit a double, and folding it
  // through one would quietly drop the low bits — which showed up as every
  // reference ending in the same two characters.
  const digest = ((BigInt(low) << 32n) | BigInt(high))
    .toString(DIGEST_ALPHABET)
    .toUpperCase();
  return `${prefix}-${digest.slice(-DIGEST_LENGTH).padStart(DIGEST_LENGTH, '0')}`;
};

/** `CASE-1A2B3C4D` — a dispute, as quoted by either side. */
export const caseReference = (disputeId: string): string => reference('CASE', disputeId);

/** `CLAIM-1A2B3C4D` — a refund claim, as quoted by either side. */
export const claimReference = (refundId: string): string => reference('CLAIM', refundId);

/** `RFQ-1A2B3C4D` — a request for quotes. */
export const requestReference = (rfqId: string): string => reference('RFQ', rfqId);

/** `QUOTE-1A2B3C4D` — one shop's answer to a request. */
export const quoteReference = (quoteId: string): string => reference('QUOTE', quoteId);

/** `ORDER-1A2B3C4D` — a confirmed order, as quoted by either side. */
export const orderReference = (orderId: string): string => reference('ORDER', orderId);

/** `PAYOUT-1A2B3C4D` — one release of money to a shop. */
export const payoutReference = (payoutId: string): string => reference('PAYOUT', payoutId);

/** `PART-1A2B3C4D` — a line in a shop's own inventory. */
export const partReference = (partId: string): string => reference('PART', partId);

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
