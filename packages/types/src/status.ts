import { z } from 'zod';
import {
  ACTOR_ROLES,
  DISPUTE_OUTCOMES,
  DISPUTE_STATUSES,
  EVIDENCE_KINDS,
  MESSAGE_CONTEXT_KINDS,
  ORDER_ISSUE_REASONS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  PRODUCTION_PROGRESS_STATUSES,
  PRODUCTION_STAGES,
  QUOTE_STATUSES,
  REFUND_STATUSES,
  RFQ_DECLINE_REASONS,
  RFQ_RECIPIENT_STATUSES,
  RFQ_STATUSES,
  SUBSTITUTION_STATUSES,
} from '@ideeza/domain';

/**
 * The boundary validates against the same vocabulary the domain owns, so a
 * status can never enter the system through an API that the domain rejects.
 */
export const rfqStatusSchema = z.enum(RFQ_STATUSES);
export const rfqRecipientStatusSchema = z.enum(RFQ_RECIPIENT_STATUSES);
export const rfqDeclineReasonSchema = z.enum(RFQ_DECLINE_REASONS);
export const quoteStatusSchema = z.enum(QUOTE_STATUSES);
export const substitutionStatusSchema = z.enum(SUBSTITUTION_STATUSES);
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const productionStageKeySchema = z.enum(PRODUCTION_STAGES);
export const productionProgressStatusSchema = z.enum(PRODUCTION_PROGRESS_STATUSES);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const payoutStatusSchema = z.enum(PAYOUT_STATUSES);
export const refundStatusSchema = z.enum(REFUND_STATUSES);
export const disputeStatusSchema = z.enum(DISPUTE_STATUSES);
export const disputeOutcomeSchema = z.enum(DISPUTE_OUTCOMES);
export const orderIssueReasonSchema = z.enum(ORDER_ISSUE_REASONS);
export const actorRoleSchema = z.enum(ACTOR_ROLES);
export const messageContextKindSchema = z.enum(MESSAGE_CONTEXT_KINDS);
export const evidenceKindSchema = z.enum(EVIDENCE_KINDS);
