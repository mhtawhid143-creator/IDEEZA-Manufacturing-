'use server';

import { DomainError, asId, type QuoteId, type RfqId } from '@ideeza/domain';
import { reviseQuote, submitQuote, withdrawQuote } from '@/data/quotes.js';
import { requireManufacturer } from '@/lib/auth.js';

export interface QuoteFormPayload {
  readonly rfqId: string;
  readonly quoteId?: string | undefined;
  readonly unitPriceMajor: string;
  readonly leadTimeDays: string;
  readonly expiresOn: string;
  readonly shippingMajor: string;
  readonly toolingMajor: string;
  readonly materialProcessNotes: string;
  readonly warrantyTerms: string;
  readonly terms: string;
  readonly volumePrices: readonly {
    readonly quantity: number;
    readonly unitPriceMajor: string;
    readonly leadTimeDays: string;
  }[];
}

export interface QuoteActionState {
  readonly quoteId?: string;
  readonly error?: string;
}

/** A price is typed in major units and stored in minor units. */
const minorOf = (major: string): number | null => {
  const text = major.trim();
  if (text === '') return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round(value * 100);
};

const wholeOf = (value: string): number | null => {
  const text = value.trim();
  if (text === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.round(parsed) : Number.NaN;
};

const dateOf = (value: string): Date | null => {
  const text = value.trim();
  if (text === '') return null;
  // End of the chosen day: a quote that says "valid until the 30th" is valid on
  // the 30th, not until midnight at its start.
  const parsed = new Date(`${text}T23:59:59.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

interface ReadTerms {
  readonly ok: true;
  readonly unitPriceMinor: number;
  readonly leadTimeDays: number;
  readonly expiresAt: Date;
  readonly shippingEstimateMinor: number | null;
  readonly toolingSetupCostMinor: number | null;
  readonly materialProcessNotes: string;
  readonly warrantyTerms: string | null;
  readonly terms: string;
  readonly volumePrices: readonly {
    readonly quantity: number;
    readonly unitPriceMinor: number;
    readonly leadTimeDays: number | null;
  }[];
}

/**
 * Reads the form into the numbers the domain checks.
 *
 * Only the reading happens here: whether the numbers are usable is the domain's
 * decision, in one place, so the form and any future importer answer to the same
 * rules.
 */
const read = (payload: QuoteFormPayload): ReadTerms | { readonly error: string } => {
  const unitPriceMinor = minorOf(payload.unitPriceMajor);
  if (unitPriceMinor === null || Number.isNaN(unitPriceMinor)) {
    return { error: 'Enter the price per unit.' };
  }
  const leadTimeDays = wholeOf(payload.leadTimeDays);
  if (leadTimeDays === null || Number.isNaN(leadTimeDays)) {
    return { error: 'Enter the lead time in days.' };
  }
  const expiresAt = dateOf(payload.expiresOn);
  if (expiresAt === null) return { error: 'Choose the date the quote is valid until.' };

  const shipping = minorOf(payload.shippingMajor);
  if (shipping !== null && Number.isNaN(shipping)) {
    return { error: 'That shipping estimate is not a number.' };
  }
  const tooling = minorOf(payload.toolingMajor);
  if (tooling !== null && Number.isNaN(tooling)) {
    return { error: 'That tooling and setup cost is not a number.' };
  }

  const volumePrices: {
    quantity: number;
    unitPriceMinor: number;
    leadTimeDays: number | null;
  }[] = [];
  for (const tier of payload.volumePrices) {
    const price = minorOf(tier.unitPriceMajor);
    if (price === null) continue;
    if (Number.isNaN(price)) {
      return { error: `That price at ${tier.quantity} units is not a number.` };
    }
    const days = wholeOf(tier.leadTimeDays);
    if (days !== null && Number.isNaN(days)) {
      return { error: `That lead time at ${tier.quantity} units is not a number.` };
    }
    volumePrices.push({
      quantity: tier.quantity,
      unitPriceMinor: price,
      leadTimeDays: days,
    });
  }

  const warranty = payload.warrantyTerms.trim();

  return {
    ok: true,
    unitPriceMinor,
    leadTimeDays,
    expiresAt,
    shippingEstimateMinor: shipping,
    toolingSetupCostMinor: tooling,
    materialProcessNotes: payload.materialProcessNotes,
    warrantyTerms: warranty === '' ? null : warranty,
    terms: payload.terms,
    volumePrices,
  };
};

/** Sends this shop's quote for one request. */
export const submitQuoteAction = async (
  payload: QuoteFormPayload,
): Promise<QuoteActionState> => {
  const actor = await requireManufacturer(`/rfqs/${payload.rfqId}/quote`);
  const terms = read(payload);
  if (!('ok' in terms)) return { error: terms.error };

  try {
    const result = await submitQuote(actor.manufacturerId, asId<RfqId>(payload.rfqId), {
      unitPriceMinor: terms.unitPriceMinor,
      leadTimeDays: terms.leadTimeDays,
      expiresAt: terms.expiresAt,
      shippingEstimateMinor: terms.shippingEstimateMinor,
      toolingSetupCostMinor: terms.toolingSetupCostMinor,
      materialProcessNotes: terms.materialProcessNotes,
      warrantyTerms: terms.warrantyTerms,
      terms: terms.terms,
      volumePrices: terms.volumePrices,
    });
    return result.ok ? { quoteId: result.quoteId } : { error: result.message };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
};

/** Revises a quote already with the buyer. */
export const reviseQuoteAction = async (
  payload: QuoteFormPayload,
): Promise<QuoteActionState> => {
  const quoteId = payload.quoteId ?? '';
  if (quoteId === '') return { error: 'That quote could not be identified.' };
  const actor = await requireManufacturer(`/quotes/${quoteId}/revise`);
  const terms = read(payload);
  if (!('ok' in terms)) return { error: terms.error };

  try {
    const result = await reviseQuote(actor.manufacturerId, asId<QuoteId>(quoteId), {
      unitPriceMinor: terms.unitPriceMinor,
      leadTimeDays: terms.leadTimeDays,
      expiresAt: terms.expiresAt,
      shippingEstimateMinor: terms.shippingEstimateMinor,
      toolingSetupCostMinor: terms.toolingSetupCostMinor,
      materialProcessNotes: terms.materialProcessNotes,
      warrantyTerms: terms.warrantyTerms,
      terms: terms.terms,
      volumePrices: terms.volumePrices,
    });
    return result.ok ? { quoteId: result.quoteId } : { error: result.message };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
};

export interface WithdrawState {
  readonly withdrawn: boolean;
  readonly error?: string;
}

/** Takes a quote off the table. */
export const withdrawQuoteAction = async (
  quoteIdInput: string,
): Promise<WithdrawState> => {
  const actor = await requireManufacturer(`/quotes/${quoteIdInput}/withdraw`);
  try {
    const result = await withdrawQuote(actor.manufacturerId, asId<QuoteId>(quoteIdInput));
    return result.ok ? { withdrawn: true } : { withdrawn: false, error: result.message };
  } catch (error) {
    if (error instanceof DomainError) return { withdrawn: false, error: error.message };
    if (error instanceof Error) return { withdrawn: false, error: error.message };
    throw error;
  }
};
