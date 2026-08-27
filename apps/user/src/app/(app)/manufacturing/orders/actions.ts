'use server';

import { DomainError } from '@ideeza/domain';
import { answerInventoryAlertSchema } from '@ideeza/types';
import { answerInventoryAlert } from '@/data/production.js';
import { requireBuyer } from '@/lib/auth.js';

export interface AnswerState {
  readonly error?: string;
  readonly status?: string;
  readonly settlementMinor?: number;
  readonly delayDays?: number;
}

/**
 * Answers a shortage the manufacturer raised on a confirmed order.
 *
 * The buyer is the only party who may answer it, so the guard runs first; the
 * domain then decides whether that answer is available at all. Nothing is
 * revalidated because every order screen is rendered fresh.
 */
export const answerInventoryAlertAction = async (input: {
  readonly alertId: string;
  readonly resolution: string;
  readonly note?: string;
}): Promise<AnswerState> => {
  const actor = await requireBuyer('/manufacturing/orders');

  const parsed = answerInventoryAlertSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That answer is not valid.' };
  }

  try {
    const result = await answerInventoryAlert(actor.userId, parsed.data);
    return {
      status: result.status,
      settlementMinor: result.settlementMinor,
      delayDays: result.delayDays,
    };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    return { error: 'That answer could not be saved.' };
  }
};
