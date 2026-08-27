'use server';

import { DomainError } from '@ideeza/domain';
import {
  addDisputeStatementSchema,
  cancelOrderSchema,
  openDisputeSchema,
  requestRefundSchema,
} from '@ideeza/types';
import {
  addDisputeStatement,
  cancelOrder,
  openDispute,
  requestRefund,
} from '@/data/resolution.js';
import { requireBuyer } from '@/lib/auth.js';

export interface IssueState {
  readonly error?: string;
  readonly redirectTo?: string;
  readonly note?: string;
}

const failure = (error: unknown, fallback: string): IssueState => {
  if (error instanceof DomainError) return { error: error.message };
  if (error instanceof Error) return { error: error.message };
  return { error: fallback };
};

/** Withdraws an unfunded order, or asks IDEEZA to stop a funded one. */
export const cancelOrderAction = async (input: {
  readonly orderId: string;
  readonly reason: string;
  readonly description: string;
}): Promise<IssueState> => {
  const actor = await requireBuyer(`/manufacturing/orders/${input.orderId}/cancel`);

  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That request is not valid.' };
  }

  try {
    const result = await cancelOrder(actor.userId, parsed.data);
    return {
      redirectTo:
        result.route === 'withdraw'
          ? '/manufacturing/orders?cancelled=1'
          : `/manufacturing/orders/${input.orderId}?cancel-requested=1`,
      note: result.route,
    };
  } catch (error) {
    return failure(error, 'That cancellation could not be recorded.');
  }
};

/** Asks for money back, with the records the claim rests on. */
export const requestRefundAction = async (input: {
  readonly orderId: string;
  readonly reason: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly description: string;
  readonly evidenceFileIds: readonly string[];
  readonly expectedOutcome?: string;
}): Promise<IssueState> => {
  const actor = await requireBuyer(`/manufacturing/orders/${input.orderId}/refund`);

  const parsed = requestRefundSchema.safeParse({
    orderId: input.orderId,
    reason: input.reason,
    requestedAmount: { amountMinor: input.amountMinor, currency: input.currency },
    description: input.description,
    evidenceFileIds: [...input.evidenceFileIds],
    ...(input.expectedOutcome === undefined ? {} : { expectedOutcome: input.expectedOutcome }),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That claim is not valid.' };
  }

  try {
    await requestRefund(actor.userId, parsed.data);
    return { redirectTo: `/manufacturing/orders/${input.orderId}?refund-requested=1` };
  } catch (error) {
    return failure(error, 'That refund claim could not be recorded.');
  }
};

/** Opens a dispute, which IDEEZA decides on the documented record. */
export const openDisputeAction = async (input: {
  readonly orderId: string;
  readonly reason: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly statement: string;
  readonly evidenceFileIds: readonly string[];
  readonly refundId?: string;
}): Promise<IssueState> => {
  const actor = await requireBuyer(`/manufacturing/orders/${input.orderId}/dispute`);

  const parsed = openDisputeSchema.safeParse({
    orderId: input.orderId,
    reason: input.reason,
    claimedAmount: { amountMinor: input.amountMinor, currency: input.currency },
    statement: input.statement,
    evidenceFileIds: [...input.evidenceFileIds],
    ...(input.refundId === undefined ? {} : { refundId: input.refundId }),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That dispute is not valid.' };
  }

  try {
    const result = await openDispute(actor.userId, parsed.data);
    return {
      redirectTo: `/manufacturing/orders/${input.orderId}/dispute/${result.disputeId}?opened=1`,
    };
  } catch (error) {
    return failure(error, 'That dispute could not be opened.');
  }
};

/** Adds a further statement to a live dispute. */
export const addDisputeStatementAction = async (input: {
  readonly orderId: string;
  readonly disputeId: string;
  readonly statement: string;
  readonly evidenceFileIds: readonly string[];
}): Promise<IssueState> => {
  const actor = await requireBuyer(`/manufacturing/orders/${input.orderId}/dispute`);

  const parsed = addDisputeStatementSchema.safeParse({
    disputeId: input.disputeId,
    statement: input.statement,
    evidenceFileIds: [...input.evidenceFileIds],
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That statement is not valid.' };
  }

  try {
    await addDisputeStatement(actor.userId, parsed.data);
    return { note: 'added' };
  } catch (error) {
    return failure(error, 'That statement could not be added.');
  }
};
