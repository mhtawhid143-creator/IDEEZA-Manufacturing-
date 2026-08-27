'use server';

import { DomainError } from '@ideeza/domain';
import {
  addDisputeStatement,
  approveRefund,
  challengeRefund,
} from '@/data/resolution.js';
import { requireManufacturer } from '@/lib/auth.js';

export interface ResolutionState {
  readonly done: boolean;
  readonly disputeId?: string;
  readonly error?: string;
}

const minorOf = (major: string): number | null => {
  const text = major.trim();
  if (text === '') return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round(value * 100);
};

const failed = (error: unknown): ResolutionState => {
  if (error instanceof DomainError) return { done: false, error: error.message };
  if (error instanceof Error) return { done: false, error: error.message };
  throw error;
};

/** Accepts a refund claim as the buyer made it. */
export const approveRefundAction = async (
  orderId: string,
  refundId: string,
  note: string,
): Promise<ResolutionState> => {
  const actor = await requireManufacturer(`/orders/${orderId}/refund-response`);
  try {
    const result = await approveRefund(
      actor.manufacturerId,
      actor.userId,
      refundId,
      note,
    );
    return result.ok ? { done: true } : { done: false, error: result.message };
  } catch (error) {
    return failed(error);
  }
};

/** Challenges a refund claim, which opens a dispute operations decides. */
export const challengeRefundAction = async (
  orderId: string,
  refundId: string,
  acceptableMajor: string,
  statement: string,
): Promise<ResolutionState> => {
  const actor = await requireManufacturer(`/orders/${orderId}/dispute`);
  const acceptable = minorOf(acceptableMajor) ?? 0;
  if (Number.isNaN(acceptable)) {
    return { done: false, error: 'That amount is not a number.' };
  }

  try {
    const result = await challengeRefund(actor.manufacturerId, actor.userId, refundId, {
      acceptableAmountMinor: acceptable,
      statement,
    });
    return result.ok
      ? { done: true, disputeId: result.id }
      : { done: false, error: result.message };
  } catch (error) {
    return failed(error);
  }
};

/** Adds a statement to a dispute both sides read. */
export const addStatementAction = async (
  orderId: string,
  disputeId: string,
  title: string,
  body: string,
): Promise<ResolutionState> => {
  const actor = await requireManufacturer(`/orders/${orderId}/dispute`);
  try {
    const result = await addDisputeStatement(
      actor.manufacturerId,
      actor.userId,
      disputeId,
      title,
      body,
    );
    return result.ok ? { done: true } : { done: false, error: result.message };
  } catch (error) {
    return failed(error);
  }
};
