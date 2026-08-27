'use server';

import { DomainError, asId, type QuoteId, type RfqId } from '@ideeza/domain';
import { sendRequestSchema } from '@ideeza/types';
import { addRecipients, submitRequest, withdrawRequest } from '@/data/requests.js';
import { acceptQuote, decideSubstitution, rejectQuote } from '@/data/quotes.js';
import { requireBuyer } from '@/lib/auth.js';

export interface SendRequestState {
  readonly error?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  /** Set once the request has been sent: where its status now lives. */
  readonly redirectTo?: string;
}

const textOf = (value: FormDataEntryValue | null): string =>
  typeof value === 'string' ? value.trim() : '';

const optionalTextOf = (value: FormDataEntryValue | null): string | undefined => {
  const text = textOf(value);
  return text === '' ? undefined : text;
};

const numberOf = (value: FormDataEntryValue | null): number => {
  const parsed = Number(textOf(value));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

/** "250, 500" is two keystrokes for the buyer and a list for the request. */
const tiersOf = (value: FormDataEntryValue | null): readonly number[] =>
  textOf(value)
    .split(/[,\s]+/)
    .filter((part) => part !== '')
    .map((part) => Number(part));

/** A price is typed in major units and stored in minor units. */
const minorOf = (value: FormDataEntryValue | null): number | undefined => {
  const text = textOf(value);
  if (text === '') return undefined;
  const major = Number(text);
  if (!Number.isFinite(major)) return Number.NaN;
  return Math.round(major * 100);
};

const FIELD_MESSAGE: Readonly<Record<string, string>> = {
  requestedServices: 'Choose at least one service to be quoted.',
  manufacturerIds: 'Choose at least one manufacturer to send this request to.',
  quantity: 'The volume has to be a whole number of units above zero.',
  volumeTiers: 'Every extra volume has to be a whole number of units above zero.',
  targetPriceMinor: 'That target price is not a number.',
  neededBy: 'That date could not be read.',
  responseDeadline: 'That date could not be read.',
};

/**
 * Sends a prepared draft to the manufacturers the buyer selected.
 *
 * The whole decision is taken on the server: the draft has to belong to this
 * buyer, it has to still be a draft, and every rule about services, recipients,
 * tiers and deadlines is checked in the domain before anything is written.
 */
export const sendRequestAction = async (
  _previous: SendRequestState,
  form: FormData,
): Promise<SendRequestState> => {
  const actor = await requireBuyer('/manufacturing/rfq/new');

  const parsed = sendRequestSchema.safeParse({
    rfqId: textOf(form.get('rfqId')),
    requestedServices: form.getAll('requestedServices').map((value) => String(value)),
    manufacturerIds: form.getAll('manufacturerIds').map((value) => String(value)),
    quantity: numberOf(form.get('quantity')),
    volumeTiers: tiersOf(form.get('volumeTiers')),
    assembly: textOf(form.get('assembly')),
    assemblySides: optionalTextOf(form.get('assemblySides')),
    targetPriceMinor: minorOf(form.get('targetPrice')),
    neededBy: optionalTextOf(form.get('neededBy')),
    responseDeadline: optionalTextOf(form.get('responseDeadline')),
    notes: optionalTextOf(form.get('notes')),
    deliveryAddress: {
      line1: textOf(form.get('line1')),
      line2: optionalTextOf(form.get('line2')),
      city: textOf(form.get('city')),
      region: optionalTextOf(form.get('region')),
      postalCode: optionalTextOf(form.get('postalCode')),
      countryCode: textOf(form.get('countryCode')).toUpperCase(),
    },
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.filter((part) => typeof part === 'string').join('.');
      const key = field === '' ? 'form' : field;
      fieldErrors[key] ??= FIELD_MESSAGE[key] ?? issue.message;
    }
    const first = Object.keys(fieldErrors)[0] ?? 'form';
    return {
      error: fieldErrors[first] ?? 'Some of the request details still need attention.',
      fieldErrors,
    };
  }

  try {
    const sent = await submitRequest(actor.userId, parsed.data);
    return { redirectTo: `/manufacturing/rfq/${sent}?sent=1` };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error && /does not exist|closed/.test(error.message)) {
      return { error: error.message };
    }
    throw error;
  }
};

export interface RecipientsAddedState {
  readonly added?: number;
  readonly error?: string;
}

/** Sends a request that is already out to more manufacturers. */
export const addRecipientsAction = async (
  rfqIdInput: string,
  manufacturerIds: readonly string[],
): Promise<RecipientsAddedState> => {
  const actor = await requireBuyer(`/manufacturing/rfq/${rfqIdInput}`);
  try {
    const added = await addRecipients(actor.userId, asId<RfqId>(rfqIdInput), manufacturerIds);
    return { added };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
};

export interface WithdrawRequestState {
  readonly withdrawn: boolean;
  readonly error?: string;
}

/** Withdraws a request that is still out for quotes. */
export const withdrawRequestAction = async (
  rfqIdInput: string,
): Promise<WithdrawRequestState> => {
  const actor = await requireBuyer(`/manufacturing/rfq/${rfqIdInput}`);
  try {
    await withdrawRequest(actor.userId, asId<RfqId>(rfqIdInput));
    return { withdrawn: true };
  } catch (error) {
    if (error instanceof DomainError) return { withdrawn: false, error: error.message };
    if (error instanceof Error) return { withdrawn: false, error: error.message };
    throw error;
  }
};

export interface AcceptQuoteState {
  readonly orderId?: string;
  readonly error?: string;
}

/**
 * Accepts one quote.
 *
 * The rule the platform turns on lives in the domain: the order that appears is
 * not confirmed, it is awaiting payment.
 */
export const acceptQuoteAction = async (
  quoteIdInput: string,
): Promise<AcceptQuoteState> => {
  const actor = await requireBuyer('/manufacturing/rfq');
  try {
    const result = await acceptQuote(actor.userId, asId<QuoteId>(quoteIdInput));
    return { orderId: result.orderId };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
};

export interface QuoteDecisionState {
  readonly done?: boolean;
  readonly error?: string;
}

/** Declines one quote, which leaves every other quote on the request alone. */
export const rejectQuoteAction = async (
  quoteIdInput: string,
): Promise<QuoteDecisionState> => {
  const actor = await requireBuyer('/manufacturing/rfq');
  try {
    await rejectQuote(actor.userId, asId<QuoteId>(quoteIdInput));
    return { done: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
};

/** Approves or rejects a replacement part a manufacturer suggested. */
export const decideSubstitutionAction = async (
  substitutionId: string,
  decision: 'approved' | 'rejected',
): Promise<QuoteDecisionState> => {
  const actor = await requireBuyer('/manufacturing/rfq');
  try {
    await decideSubstitution(actor.userId, substitutionId, decision);
    return { done: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
};
