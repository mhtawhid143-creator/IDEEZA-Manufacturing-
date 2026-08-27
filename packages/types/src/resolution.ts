import { z } from 'zod';
import { CANCELLATION_REASONS } from '@ideeza/domain';
import { idSchema, isoTimestampSchema, moneySchema, positiveMoneySchema } from './common.js';
import {
  disputeOutcomeSchema,
  disputeStatusSchema,
  evidenceKindSchema,
  orderIssueReasonSchema,
  refundStatusSchema,
} from './status.js';

export const evidenceSchema = z.object({
  id: idSchema,
  orderId: idSchema,
  kind: evidenceKindSchema,
  title: z.string().min(1).max(200),
  fileId: idSchema.optional(),
  submittedById: idSchema.optional(),
  capturedAt: isoTimestampSchema,
});

/**
 * A refund request must arrive with evidence.
 *
 * Manufacturing quality is judged against agreed specifications, so a claim
 * without a record cannot be decided fairly and is refused at the boundary.
 */
export const requestRefundSchema = z.object({
  orderId: idSchema,
  reason: orderIssueReasonSchema,
  requestedAmount: positiveMoneySchema,
  description: z.string().min(20).max(4000),
  evidenceFileIds: z.array(idSchema).min(1).max(20),
  expectedOutcome: z
    .enum(['refund', 'partial_refund', 'rework', 'replacement'])
    .optional(),
});
export type RequestRefundInput = z.infer<typeof requestRefundSchema>;

export const respondToRefundSchema = z.object({
  refundId: idSchema,
  response: z.enum(['approve', 'challenge']),
  note: z.string().max(4000).optional(),
  evidenceFileIds: z.array(idSchema).max(20).default([]),
});
export type RespondToRefundInput = z.infer<typeof respondToRefundSchema>;

export const refundSchema = z.object({
  id: idSchema,
  orderId: idSchema,
  requestedById: idSchema,
  status: refundStatusSchema,
  reason: orderIssueReasonSchema,
  requestedAmount: moneySchema,
  approvedAmount: moneySchema.optional(),
  description: z.string(),
  evidenceIds: z.array(idSchema),
  manufacturerRespondedAt: isoTimestampSchema.optional(),
  decidedAt: isoTimestampSchema.optional(),
  createdAt: isoTimestampSchema,
});

export const openDisputeSchema = z.object({
  orderId: idSchema,
  refundId: idSchema.optional(),
  reason: orderIssueReasonSchema,
  claimedAmount: positiveMoneySchema,
  statement: z.string().min(20).max(8000),
  evidenceFileIds: z.array(idSchema).min(1).max(20),
});
export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;

export const resolveDisputeSchema = z.object({
  disputeId: idSchema,
  outcome: disputeOutcomeSchema,
  outcomeAmount: positiveMoneySchema.optional(),
  rationale: z.string().min(20).max(8000),
});
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

export const disputeSchema = z.object({
  id: idSchema,
  orderId: idSchema,
  refundId: idSchema.optional(),
  openedById: idSchema,
  status: disputeStatusSchema,
  reason: orderIssueReasonSchema,
  claimedAmount: moneySchema,
  evidenceIds: z.array(idSchema),
  outcome: disputeOutcomeSchema.optional(),
  outcomeAmount: moneySchema.optional(),
  resolvedAt: isoTimestampSchema.optional(),
  createdAt: isoTimestampSchema,
});

/**
 * A buyer asking to stop an order.
 *
 * The reason comes from the cancellation list, not from the quality list a
 * refund uses, and the note is required because someone at IDEEZA has to be
 * able to decide the request without asking a follow-up question.
 */
export const cancelOrderSchema = z.object({
  orderId: idSchema,
  reason: z.enum(CANCELLATION_REASONS),
  description: z.string().trim().min(10).max(4000),
});
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

/** A further statement on a dispute that is still live. */
export const addDisputeStatementSchema = z.object({
  disputeId: idSchema,
  statement: z.string().trim().min(10).max(8000),
  evidenceFileIds: z.array(idSchema).max(20).default([]),
});
export type AddDisputeStatementInput = z.infer<typeof addDisputeStatementSchema>;
