import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  assertSubstituteSuggestionUsable,
  coverageOf,
  substituteImpact,
  unansweredShortages,
} from '../src/index.js';

describe('what a shop can build from its own stock', () => {
  it('is covered when there is enough that is not already promised', () => {
    expect(coverageOf({ requiredTotal: 400, available: 400 })).toEqual({
      state: 'covered',
      shortfall: 0,
    });
  });

  it('is short when some of the part is held', () => {
    expect(coverageOf({ requiredTotal: 400, available: 250 })).toEqual({
      state: 'short',
      shortfall: 150,
    });
  });

  it('is missing when the part is not in the inventory at all', () => {
    expect(coverageOf({ requiredTotal: 400, available: null })).toEqual({
      state: 'missing',
      shortfall: 400,
    });
  });

  it('counts only the shortages nobody has answered', () => {
    expect(
      unansweredShortages([
        { coverage: 'covered', hasSuggestion: false },
        { coverage: 'short', hasSuggestion: true },
        { coverage: 'missing', hasSuggestion: false },
      ]),
    ).toBe(1);
  });
});

describe('a substitute suggestion the buyer can act on', () => {
  const usable = {
    requestedSku: 'RF-SIK915',
    substituteSku: 'RF-SIK868',
    requiredTotal: 400,
    availableOfSubstitute: 500,
    substitutionPolicy: 'with_approval',
    justification: 'Same transceiver family, 868MHz band, pin compatible footprint.',
  };

  it('accepts a different part the shop can actually deliver', () => {
    expect(() => assertSubstituteSuggestionUsable(usable)).not.toThrow();
  });

  it('refuses one at all when the buyer said no substitutions', () => {
    expect(() =>
      assertSubstituteSuggestionUsable({ ...usable, substitutionPolicy: 'not_allowed' }),
    ).toThrow(InvariantViolationError);
  });

  it('refuses the part that is missing as its own substitute', () => {
    expect(() =>
      assertSubstituteSuggestionUsable({ ...usable, substituteSku: 'rf-sik915' }),
    ).toThrow(/the part that is missing/);
  });

  it('refuses a substitute there is not enough of', () => {
    expect(() =>
      assertSubstituteSuggestionUsable({ ...usable, availableOfSubstitute: 120 }),
    ).toThrow(/covers 120 of the 400/);
  });

  it('refuses one with no reason a buyer’s engineer could judge', () => {
    expect(() =>
      assertSubstituteSuggestionUsable({ ...usable, justification: 'ok' }),
    ).toThrow(/say why/);
  });
});

describe('what a substitute does to the price and the date', () => {
  it('is the cost difference across the whole batch', () => {
    expect(
      substituteImpact({
        requestedUnitCostMinor: 1_850,
        substituteUnitCostMinor: 2_100,
        requiredTotal: 400,
        requestedLeadTimeDays: 10,
        substituteLeadTimeDays: 14,
      }),
    ).toEqual({ priceImpactMinor: 100_000, leadTimeImpactDays: 4 });
  });

  it('is a saving when the substitute is cheaper', () => {
    expect(
      substituteImpact({
        requestedUnitCostMinor: 2_100,
        substituteUnitCostMinor: 1_850,
        requiredTotal: 100,
        requestedLeadTimeDays: 14,
        substituteLeadTimeDays: 10,
      }),
    ).toEqual({ priceImpactMinor: -25_000, leadTimeImpactDays: 0 });
  });

  it('is nothing when the specified part has no cost on record here', () => {
    expect(
      substituteImpact({
        requestedUnitCostMinor: null,
        substituteUnitCostMinor: 2_100,
        requiredTotal: 400,
        requestedLeadTimeDays: null,
        substituteLeadTimeDays: 21,
      }),
    ).toEqual({ priceImpactMinor: 0, leadTimeImpactDays: 0 });
  });
});
