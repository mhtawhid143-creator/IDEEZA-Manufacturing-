import { InvariantViolationError } from '../errors.js';

/**
 * Whether a shop can build a line from its own stock.
 *
 * This is about the bill of materials, before any quote exists — a different
 * question from `InventoryAlert`, which is a shortage found after the terms were
 * frozen and an order is running. Here nothing is committed yet, so the answer
 * is simply what the shop has: enough, some, or none.
 */
export const COVERAGE_STATES = ['covered', 'short', 'missing'] as const;
export type CoverageState = (typeof COVERAGE_STATES)[number];

export interface CoverageInput {
  /** Parts needed for the whole batch: per unit times the request quantity. */
  readonly requiredTotal: number;
  /** On hand and not already promised to another order. */
  readonly available: number | null;
}

export interface Coverage {
  readonly state: CoverageState;
  /** How many parts short, zero when covered. */
  readonly shortfall: number;
}

/**
 * A line is short when the shop holds some of the part and missing when the part
 * is not in its inventory at all. The difference matters: a short line can be
 * topped up from a distributor, a missing line usually cannot without changing
 * the part.
 */
export const coverageOf = (input: CoverageInput): Coverage => {
  if (input.requiredTotal <= 0) return { state: 'covered', shortfall: 0 };
  if (input.available === null) {
    return { state: 'missing', shortfall: input.requiredTotal };
  }
  if (input.available >= input.requiredTotal) return { state: 'covered', shortfall: 0 };
  return { state: 'short', shortfall: input.requiredTotal - input.available };
};

/** The lines that stop a quote being priced honestly until they are answered. */
export const unansweredShortages = (
  lines: readonly {
    readonly coverage: CoverageState;
    readonly hasSuggestion: boolean;
  }[],
): number =>
  lines.filter((line) => line.coverage !== 'covered' && !line.hasSuggestion).length;

export interface SubstituteSuggestionInput {
  readonly requestedSku: string | null;
  readonly substituteSku: string;
  readonly requiredTotal: number;
  readonly availableOfSubstitute: number;
  /** The buyer's policy on the request, which is theirs and not negotiable. */
  readonly substitutionPolicy: string;
  readonly justification: string;
}

/**
 * What makes a substitute suggestion a real answer.
 *
 * A suggestion the buyer cannot act on is worse than no suggestion: it delays the
 * decision and hides the shortage. So a substitute has to be a different part,
 * one the shop can actually deliver in the quantity needed, with a reason a
 * buyer's engineer can judge — and it has to be allowed at all, because a buyer
 * who wrote "no substitutions" has already answered this question.
 */
export const assertSubstituteSuggestionUsable = (
  input: SubstituteSuggestionInput,
): void => {
  if (input.substitutionPolicy === 'not_allowed') {
    throw new InvariantViolationError(
      'substitution-not-allowed',
      'this request does not allow substitutions, so the part has to be sourced as specified or the request declined',
    );
  }
  if (
    input.requestedSku !== null &&
    input.requestedSku.toLowerCase() === input.substituteSku.toLowerCase()
  ) {
    throw new InvariantViolationError(
      'substitution-same-part',
      'the substitute is the part that is missing',
    );
  }
  if (input.availableOfSubstitute < input.requiredTotal) {
    throw new InvariantViolationError(
      'substitution-not-enough-stock',
      `the substitute covers ${input.availableOfSubstitute} of the ${input.requiredTotal} parts needed`,
    );
  }
  if (input.justification.trim().length < 10) {
    throw new InvariantViolationError(
      'substitution-needs-a-reason',
      'say why this part can stand in for the one specified; the buyer has to be able to judge it',
    );
  }
};

export interface SubstituteImpactInput {
  /** The specified part's unit cost, when the shop holds it at all. */
  readonly requestedUnitCostMinor: number | null;
  readonly substituteUnitCostMinor: number;
  readonly requiredTotal: number;
  readonly requestedLeadTimeDays: number | null;
  readonly substituteLeadTimeDays: number;
}

export interface SubstituteImpact {
  readonly priceImpactMinor: number;
  readonly leadTimeImpactDays: number;
}

/**
 * What the substitute does to the price and the date, derived rather than typed.
 *
 * Both panels read these two numbers, so they are computed from the shop's own
 * inventory costs instead of being asked for twice. Where the specified part is
 * not in the shop's inventory there is no cost on record to compare against, and
 * the impact is nothing rather than a guess — the quote price says what the work
 * costs, and the justification says why the part changed.
 */
export const substituteImpact = (input: SubstituteImpactInput): SubstituteImpact => ({
  priceImpactMinor:
    input.requestedUnitCostMinor === null
      ? 0
      : (input.substituteUnitCostMinor - input.requestedUnitCostMinor) *
        input.requiredTotal,
  leadTimeImpactDays:
    input.requestedLeadTimeDays === null
      ? 0
      : Math.max(0, input.substituteLeadTimeDays - input.requestedLeadTimeDays),
});
