'use server';

import {
  DomainError,
  RFQ_DECLINE_REASONS,
  asId,
  type RfqDeclineReason,
  type RfqId,
} from '@ideeza/domain';
import { declineRequest } from '@/data/rfqs.js';
import { saveSubstituteSuggestions } from '@/data/inventory-match.js';
import { requireManufacturer } from '@/lib/auth.js';

export interface DeclineState {
  readonly declined: boolean;
  readonly error?: string;
}

const isReason = (value: string): value is RfqDeclineReason =>
  (RFQ_DECLINE_REASONS as readonly string[]).includes(value);

/**
 * Declines one request on behalf of the shop the member is acting for.
 *
 * The route checked is the decline route, not the page the button sits on, so
 * this needs the `rfq.decline` capability whatever screen it was pressed from.
 */
export const declineRequestAction = async (
  rfqIdInput: string,
  reasonInput: string,
  noteInput: string,
): Promise<DeclineState> => {
  const actor = await requireManufacturer(`/rfqs/${rfqIdInput}/decline`);

  if (!isReason(reasonInput)) {
    return { declined: false, error: 'That is not one of the reasons on the list.' };
  }

  const note = noteInput.trim();
  if (reasonInput === 'other' && note === '') {
    return {
      declined: false,
      error: 'Say what the reason is, since it is not one of the listed ones.',
    };
  }

  try {
    const result = await declineRequest(actor.manufacturerId, asId<RfqId>(rfqIdInput), {
      reason: reasonInput,
      ...(note === '' ? {} : { note }),
    });
    return result.ok ? { declined: true } : { declined: false, error: result.message };
  } catch (error) {
    if (error instanceof DomainError) return { declined: false, error: error.message };
    if (error instanceof Error) return { declined: false, error: error.message };
    throw error;
  }
};

export interface SuggestionsState {
  readonly saved: boolean;
  readonly error?: string;
}

/**
 * Saves this shop's substitute suggestions for one request.
 *
 * The route checked is the substitutions route, so this needs
 * `substitution.suggest` whatever screen it was pressed from — and note what that
 * capability is called: suggest, not decide. Deciding is the buyer's.
 */
export const saveSuggestionsAction = async (
  rfqIdInput: string,
  inputs: readonly {
    readonly rfqItemId: string;
    readonly inventoryItemId: string | null;
    readonly justification: string;
  }[],
): Promise<SuggestionsState> => {
  const actor = await requireManufacturer(`/rfqs/${rfqIdInput}/substitutions`);

  try {
    const result = await saveSubstituteSuggestions(
      actor.manufacturerId,
      asId<RfqId>(rfqIdInput),
      inputs,
    );
    return result.ok ? { saved: true } : { saved: false, error: result.message };
  } catch (error) {
    if (error instanceof DomainError) return { saved: false, error: error.message };
    if (error instanceof Error) return { saved: false, error: error.message };
    throw error;
  }
};
