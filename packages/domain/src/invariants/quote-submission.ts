import { InvariantViolationError } from '../errors.js';

/**
 * What makes a quote an offer rather than a note.
 *
 * A buyer compares quotes and then accepts one, and acceptance freezes the terms
 * into an immutable snapshot. So every number that will be frozen has to be a
 * real number at the moment it is quoted: a price above zero, a lead time
 * somebody can plan around, and a validity date that has not already passed.
 * Nothing here is about whether the price is *good* — that is the buyer's
 * judgement, and the platform has no business making it.
 */
export interface QuoteTerms {
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly leadTimeDays: number;
  readonly expiresAt: Date;
  readonly shippingEstimateMinor?: number | null;
  readonly toolingSetupCostMinor?: number | null;
  readonly materialProcessNotes: string;
  readonly terms: string;
}

/** Longest a quote may be held open: beyond this a price is not a price. */
export const MAX_QUOTE_VALIDITY_DAYS = 180;
export const MAX_LEAD_TIME_DAYS = 365;

export const quoteGoodsTotalMinor = (terms: {
  readonly quantity: number;
  readonly unitPriceMinor: number;
}): number => terms.unitPriceMinor * terms.quantity;

/**
 * What the buyer would pay this manufacturer if they accepted as offered.
 *
 * The goods, plus the setup the manufacturer has to do, plus what it estimates
 * shipping at. The platform fee and the buyer's own shipping choice are added at
 * checkout and are not the manufacturer's to quote, so they are not here.
 */
export const quoteLandedTotalMinor = (terms: {
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly shippingEstimateMinor?: number | null;
  readonly toolingSetupCostMinor?: number | null;
}): number =>
  quoteGoodsTotalMinor(terms) +
  (terms.shippingEstimateMinor ?? 0) +
  (terms.toolingSetupCostMinor ?? 0);

export const assertQuoteTermsUsable = (terms: QuoteTerms, now: Date): void => {
  if (!Number.isInteger(terms.quantity) || terms.quantity <= 0) {
    throw new InvariantViolationError(
      'quote-quantity',
      'a quote prices a whole number of units above zero',
    );
  }
  if (!Number.isInteger(terms.unitPriceMinor) || terms.unitPriceMinor <= 0) {
    throw new InvariantViolationError(
      'quote-unit-price',
      'the price per unit has to be above zero; a quote at nothing is not a quote',
    );
  }
  for (const [field, value] of [
    ['the shipping estimate', terms.shippingEstimateMinor],
    ['the tooling and setup cost', terms.toolingSetupCostMinor],
  ] as const) {
    if (value === null || value === undefined) continue;
    if (!Number.isInteger(value) || value < 0) {
      throw new InvariantViolationError('quote-amount', `${field} cannot be negative`);
    }
  }
  if (!Number.isInteger(terms.leadTimeDays) || terms.leadTimeDays <= 0) {
    throw new InvariantViolationError(
      'quote-lead-time',
      'the lead time has to be at least one day',
    );
  }
  if (terms.leadTimeDays > MAX_LEAD_TIME_DAYS) {
    throw new InvariantViolationError(
      'quote-lead-time',
      `a lead time of more than ${MAX_LEAD_TIME_DAYS} days is not something a buyer can plan around`,
    );
  }
  if (terms.expiresAt.getTime() <= now.getTime()) {
    throw new InvariantViolationError(
      'quote-validity',
      'the quote would already have expired; choose a date in the future',
    );
  }
  const days = (terms.expiresAt.getTime() - now.getTime()) / 86_400_000;
  if (days > MAX_QUOTE_VALIDITY_DAYS) {
    throw new InvariantViolationError(
      'quote-validity',
      `a quote may be held open for at most ${MAX_QUOTE_VALIDITY_DAYS} days`,
    );
  }
  if (terms.materialProcessNotes.trim().length < 10) {
    throw new InvariantViolationError(
      'quote-material-notes',
      'say what materials and process the price is for; it is what the buyer compares and what the order freezes',
    );
  }
  if (terms.terms.trim().length < 10) {
    throw new InvariantViolationError(
      'quote-terms',
      'state your payment and delivery terms; the order is opened against them',
    );
  }
};

export interface VolumePrice {
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly leadTimeDays?: number | null;
}

/**
 * Prices for the other volumes the request asked about.
 *
 * The buyer asks for alternative quantities so they can compare at the volume
 * they may actually order. An answer at a volume nobody asked for is noise, and
 * two answers for one volume cannot both be the price — so both are refused.
 */
export const assertVolumePricesAnswerTheRequest = (
  prices: readonly VolumePrice[],
  askedFor: readonly number[],
  quotedQuantity: number,
): void => {
  const seen = new Set<number>();
  for (const price of prices) {
    if (!Number.isInteger(price.quantity) || price.quantity <= 0) {
      throw new InvariantViolationError(
        'quote-volume-quantity',
        'a volume is a whole number of units above zero',
      );
    }
    if (price.quantity !== quotedQuantity && !askedFor.includes(price.quantity)) {
      throw new InvariantViolationError(
        'quote-volume-not-asked-for',
        `${price.quantity} units is not one of the volumes this request asked to have priced`,
      );
    }
    if (seen.has(price.quantity)) {
      throw new InvariantViolationError(
        'quote-volume-twice',
        `there are two prices for ${price.quantity} units`,
      );
    }
    seen.add(price.quantity);
    if (!Number.isInteger(price.unitPriceMinor) || price.unitPriceMinor <= 0) {
      throw new InvariantViolationError(
        'quote-volume-price',
        `the price per unit at ${price.quantity} units has to be above zero`,
      );
    }
    if (
      price.leadTimeDays !== null &&
      price.leadTimeDays !== undefined &&
      (!Number.isInteger(price.leadTimeDays) || price.leadTimeDays <= 0)
    ) {
      throw new InvariantViolationError(
        'quote-volume-lead-time',
        `the lead time at ${price.quantity} units has to be at least one day`,
      );
    }
  }
};

/**
 * A quote may only answer a request that is still open.
 *
 * Answering a closed request would produce an offer nobody can accept, and
 * answering a draft would mean reading a workspace that was never sent.
 */
export const assertRequestStillTakesQuotes = (
  rfqStatus: string,
  respondBy: Date | null,
  now: Date,
): void => {
  if (rfqStatus !== 'submitted') {
    throw new InvariantViolationError(
      'quote-request-closed',
      'this request is no longer open for quotes',
    );
  }
  if (respondBy !== null && respondBy.getTime() <= now.getTime()) {
    throw new InvariantViolationError(
      'quote-response-deadline-passed',
      'the buyer’s response deadline has passed',
    );
  }
};

/**
 * Whether a quote is still live, which is not the same as its status.
 *
 * An expiry date passes without anything writing to the row, so "expired" is a
 * fact about the clock as much as about the record. Both panels have to agree on
 * it, so it is computed here.
 */
export const quoteHasExpired = (
  quote: { readonly status: string; readonly expiresAt: Date },
  now: Date,
): boolean =>
  quote.status !== 'accepted' &&
  quote.status !== 'rejected' &&
  quote.status !== 'withdrawn' &&
  quote.expiresAt.getTime() <= now.getTime();
