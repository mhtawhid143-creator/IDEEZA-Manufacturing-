import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  canTransition,
  quoteMachine,
  assertQuoteTermsUsable,
  assertRequestStillTakesQuotes,
  assertVolumePricesAnswerTheRequest,
  quoteGoodsTotalMinor,
  quoteHasExpired,
  quoteLandedTotalMinor,
} from '../src/index.js';

const NOW = new Date('2026-08-01T00:00:00.000Z');
const inDays = (days: number): Date =>
  new Date(NOW.getTime() + days * 86_400_000);

const usable = {
  quantity: 400,
  unitPriceMinor: 1_240,
  leadTimeDays: 24,
  expiresAt: inDays(21),
  shippingEstimateMinor: 8_400,
  toolingSetupCostMinor: 12_000,
  materialProcessNotes: 'FR-4 TG150, ENIG, SMT one side, AOI on 100%.',
  terms: '50% on confirmation, 50% before shipping.',
};

describe('what makes a quote sendable', () => {
  it('accepts real terms', () => {
    expect(() => assertQuoteTermsUsable(usable, NOW)).not.toThrow();
  });

  it('refuses a price of nothing', () => {
    expect(() =>
      assertQuoteTermsUsable({ ...usable, unitPriceMinor: 0 }, NOW),
    ).toThrow(InvariantViolationError);
  });

  it('refuses a fractional price, because money is integer minor units', () => {
    expect(() =>
      assertQuoteTermsUsable({ ...usable, unitPriceMinor: 12.5 }, NOW),
    ).toThrow(/above zero/);
  });

  it('refuses a negative shipping estimate', () => {
    expect(() =>
      assertQuoteTermsUsable({ ...usable, shippingEstimateMinor: -1 }, NOW),
    ).toThrow(/cannot be negative/);
  });

  it('refuses a lead time of zero days or a fantasy of years', () => {
    expect(() => assertQuoteTermsUsable({ ...usable, leadTimeDays: 0 }, NOW)).toThrow(
      /at least one day/,
    );
    expect(() => assertQuoteTermsUsable({ ...usable, leadTimeDays: 400 }, NOW)).toThrow(
      /plan around/,
    );
  });

  it('refuses a quote that has already expired', () => {
    expect(() =>
      assertQuoteTermsUsable({ ...usable, expiresAt: inDays(-1) }, NOW),
    ).toThrow(/already have expired/);
  });

  it('refuses a quote held open beyond half a year', () => {
    expect(() =>
      assertQuoteTermsUsable({ ...usable, expiresAt: inDays(200) }, NOW),
    ).toThrow(/at most 180 days/);
  });

  it('refuses terms and process notes nobody could compare', () => {
    expect(() =>
      assertQuoteTermsUsable({ ...usable, materialProcessNotes: 'FR4' }, NOW),
    ).toThrow(/materials and process/);
    expect(() => assertQuoteTermsUsable({ ...usable, terms: 'ok' }, NOW)).toThrow(
      /payment and delivery terms/,
    );
  });
});

describe('the totals both panels read', () => {
  it('is the unit price times the quantity', () => {
    expect(quoteGoodsTotalMinor({ quantity: 400, unitPriceMinor: 1_240 })).toBe(496_000);
  });

  it('adds what the manufacturer quotes on top, and nothing else', () => {
    expect(
      quoteLandedTotalMinor({
        quantity: 400,
        unitPriceMinor: 1_240,
        shippingEstimateMinor: 8_400,
        toolingSetupCostMinor: 12_000,
      }),
    ).toBe(516_400);
    expect(
      quoteLandedTotalMinor({ quantity: 10, unitPriceMinor: 100 }),
    ).toBe(1_000);
  });
});

describe('prices at the other volumes', () => {
  it('accepts a price at a volume the request asked for', () => {
    expect(() =>
      assertVolumePricesAnswerTheRequest(
        [{ quantity: 1_000, unitPriceMinor: 1_100, leadTimeDays: 30 }],
        [400, 1_000],
        400,
      ),
    ).not.toThrow();
  });

  it('refuses a volume nobody asked about', () => {
    expect(() =>
      assertVolumePricesAnswerTheRequest(
        [{ quantity: 5_000, unitPriceMinor: 900 }],
        [400, 1_000],
        400,
      ),
    ).toThrow(/not one of the volumes/);
  });

  it('refuses two prices for one volume', () => {
    expect(() =>
      assertVolumePricesAnswerTheRequest(
        [
          { quantity: 1_000, unitPriceMinor: 1_100 },
          { quantity: 1_000, unitPriceMinor: 1_000 },
        ],
        [1_000],
        400,
      ),
    ).toThrow(/two prices for 1000 units/);
  });

  it('refuses a volume priced at nothing', () => {
    expect(() =>
      assertVolumePricesAnswerTheRequest(
        [{ quantity: 1_000, unitPriceMinor: 0 }],
        [1_000],
        400,
      ),
    ).toThrow(/above zero/);
  });
});

describe('when a request can still be answered', () => {
  it('accepts an open request inside its deadline', () => {
    expect(() =>
      assertRequestStillTakesQuotes('submitted', inDays(5), NOW),
    ).not.toThrow();
  });

  it('refuses a closed or withdrawn request', () => {
    for (const status of ['closed', 'withdrawn', 'draft']) {
      expect(() => assertRequestStillTakesQuotes(status, null, NOW)).toThrow(
        /no longer open/,
      );
    }
  });

  it('refuses one whose response deadline has passed', () => {
    expect(() => assertRequestStillTakesQuotes('submitted', inDays(-1), NOW)).toThrow(
      /deadline has passed/,
    );
  });
});

describe('expiry is a fact about the clock', () => {
  it('is expired once the date has passed', () => {
    expect(quoteHasExpired({ status: 'submitted', expiresAt: inDays(-1) }, NOW)).toBe(
      true,
    );
    expect(quoteHasExpired({ status: 'submitted', expiresAt: inDays(1) }, NOW)).toBe(
      false,
    );
  });

  it('does not touch a quote that was already decided', () => {
    for (const status of ['accepted', 'rejected', 'withdrawn']) {
      expect(quoteHasExpired({ status, expiresAt: inDays(-30) }, NOW)).toBe(false);
    }
  });
});

describe('when a quote may be revised', () => {
  it('lets a manufacturer improve a quote that is still on the table', () => {
    for (const from of ['submitted', 'revised', 'revision_requested'] as const) {
      expect(
        canTransition(quoteMachine, from, 'revised', {
          acceptedQuoteCountOnRfq: 0,
          pendingSubstitutionCount: 0,
        }),
      ).toBe(true);
    }
  });

  it('refuses to revise one that is already decided', () => {
    for (const from of ['accepted', 'rejected', 'withdrawn', 'expired'] as const) {
      expect(
        canTransition(quoteMachine, from, 'revised', {
          acceptedQuoteCountOnRfq: 0,
          pendingSubstitutionCount: 0,
        }),
      ).toBe(false);
    }
  });
});
