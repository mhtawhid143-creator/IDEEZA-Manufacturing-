import { InvariantViolationError } from '../errors.js';
import { SERVICE_CAPABILITY, type QuotedService } from '../status/services.js';

/**
 * How well a manufacturer matches what the request asks for.
 *
 * `meets` — it publishes every service asked for and can take the quantity.
 * `partial` — it can take the quantity but not all of the work.
 * `cannot` — it cannot take this request at all: none of the work, or a
 * minimum order quantity above what is being asked for.
 */
export const FIT_VERDICTS = ['meets', 'partial', 'cannot'] as const;
export type FitVerdict = (typeof FIT_VERDICTS)[number];

export interface FitRequest {
  readonly requestedServices: readonly QuotedService[];
  readonly quantity: number;
  readonly leadTimeDays: number;
}

export interface FitCapability {
  readonly services: readonly string[];
  readonly minimumOrderQuantity: number | null;
  readonly standardLeadTimeDays: number | null;
  /**
   * How much of the request's bill of materials this shop holds in stock.
   *
   * Absent when the request has no bill of materials, or when the caller has not
   * matched it. Never a reason to refuse a shop — sourcing a part it does not
   * stock is ordinary work — but a real reason to rank one above another, because
   * the parts being on a shelf is the difference between a lead time that holds
   * and one that hopes.
   */
  readonly partsInStock?:
    | { readonly coveredLines: number; readonly totalLines: number }
    | undefined;
}

export interface FitAssessment {
  readonly verdict: FitVerdict;
  /**
   * The share of the request's own bill-of-materials lines this shop can cover
   * from stock, between 0 and 1, or null when there is nothing to match.
   *
   * A share, and a count of the buyer's own lines: nothing about the shop's
   * quantities, its costs or any part the request did not name crosses to the
   * buyer.
   */
  readonly stockCoverage: number | null;
  readonly partsCoveredLines: number | null;
  readonly partsTotalLines: number | null;
  /** The requested services this manufacturer does not publish. */
  readonly missingServices: readonly QuotedService[];
  /** Set when the manufacturer will not take a batch this small. */
  readonly belowMinimumOrderQuantity: boolean;
  /** Set when its usual lead time is longer than the one asked for. */
  readonly slowerThanAsked: boolean;
}

/**
 * Reads a manufacturer against a request. Pure, so the badge on a card and the
 * refusal behind it can never disagree.
 */
export const evaluateManufacturerFit = (
  request: FitRequest,
  capability: FitCapability,
): FitAssessment => {
  const missingServices = request.requestedServices.filter(
    (service) => !capability.services.includes(SERVICE_CAPABILITY[service]),
  );
  const belowMinimumOrderQuantity =
    capability.minimumOrderQuantity !== null &&
    request.quantity < capability.minimumOrderQuantity;
  const slowerThanAsked =
    capability.standardLeadTimeDays !== null &&
    capability.standardLeadTimeDays > request.leadTimeDays;

  const parts = capability.partsInStock;
  const stockCoverage =
    parts === undefined || parts.totalLines <= 0
      ? null
      : parts.coveredLines / parts.totalLines;

  const coversNothing =
    request.requestedServices.length > 0 &&
    missingServices.length === request.requestedServices.length;

  const verdict: FitVerdict =
    belowMinimumOrderQuantity || coversNothing
      ? 'cannot'
      : missingServices.length > 0 || slowerThanAsked
        ? 'partial'
        : 'meets';

  return Object.freeze({
    verdict,
    stockCoverage,
    partsCoveredLines: parts === undefined ? null : parts.coveredLines,
    partsTotalLines: parts === undefined ? null : parts.totalLines,
    missingServices: Object.freeze([...missingServices]),
    belowMinimumOrderQuantity,
    slowerThanAsked,
  });
};

/**
 * A request has to say what it wants priced.
 *
 * Without it a quote is an answer to an unasked question, and the quotes from
 * two manufacturers would not be comparable.
 */
export const assertServicesRequested = (
  services: readonly QuotedService[],
): void => {
  if (services.length === 0) {
    throw new InvariantViolationError(
      'RequestNamesTheWork',
      'a request must name at least one service to be quoted',
    );
  }
};

/**
 * A manufacturer that cannot take the request at all is not a recipient.
 *
 * It could only ever decline, and a decline that was predictable before sending
 * is noise for both sides.
 */
export const assertRecipientCanTakeRequest = (
  manufacturerName: string,
  assessment: FitAssessment,
): void => {
  if (assessment.verdict === 'cannot') {
    throw new InvariantViolationError(
      'RecipientCanTakeRequest',
      `${manufacturerName} cannot build this request${
        assessment.belowMinimumOrderQuantity
          ? ': its minimum order quantity is above the quantity asked for'
          : ': it publishes none of the services asked for'
      }`,
    );
  }
};

/**
 * The order the buyer should be shown manufacturers in.
 *
 * What the shop can actually do comes first, then how much of the bill of
 * materials it already holds, then its record. Ranking on stock rather than
 * refusing on it is the point: a shop without the parts can still quote, it just
 * has further to go, and the buyer is entitled to see which is which.
 */
export const compareManufacturerFit = (
  left: {
    readonly fit?: FitAssessment | undefined;
    readonly rating: number | null;
    readonly displayName: string;
  },
  right: {
    readonly fit?: FitAssessment | undefined;
    readonly rating: number | null;
    readonly displayName: string;
  },
): number => {
  const rank = (verdict: FitVerdict | undefined): number =>
    verdict === 'meets' ? 0 : verdict === 'partial' ? 1 : verdict === 'cannot' ? 2 : 0;

  const byVerdict = rank(left.fit?.verdict) - rank(right.fit?.verdict);
  if (byVerdict !== 0) return byVerdict;

  const leftStock = left.fit?.stockCoverage ?? null;
  const rightStock = right.fit?.stockCoverage ?? null;
  if (leftStock !== rightStock) {
    if (leftStock === null) return 1;
    if (rightStock === null) return -1;
    if (rightStock !== leftStock) return rightStock - leftStock;
  }

  const byRating = (right.rating ?? 0) - (left.rating ?? 0);
  if (byRating !== 0) return byRating;

  return left.displayName.localeCompare(right.displayName);
};
