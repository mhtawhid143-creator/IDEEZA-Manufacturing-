import { InvariantViolationError } from '../errors.js';
import type { IsoTimestamp } from '../ids.js';
import type { AcceptedQuoteSnapshot } from '../entities/order.js';
import type { ManufacturingRequirements } from '../entities/product.js';
import type { Quote } from '../entities/quote.js';

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);
  return `{${entries.join(',')}}`;
};

/** Small deterministic digest, enough to detect tampering with a snapshot. */
const digest = (input: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export interface SnapshotInput {
  readonly quote: Quote;
  readonly requirements: ManufacturingRequirements;
  readonly approvedSubstitutionIds: readonly string[];
  readonly capturedAt: IsoTimestamp;
}

/**
 * Freezes the terms both sides agreed to.
 *
 * The order keeps this copy for the life of the record, because a dispute is
 * decided on what was agreed, not on whatever the live quote row says later.
 */
export const captureAcceptedQuoteSnapshot = (
  input: SnapshotInput,
): AcceptedQuoteSnapshot => {
  const { quote, requirements, approvedSubstitutionIds, capturedAt } = input;
  if (quote.status !== 'accepted') {
    throw new InvariantViolationError(
      'accepted-quote-snapshot',
      `only an accepted quote may be captured (status was "${quote.status}")`,
    );
  }

  const body = {
    quoteId: quote.id,
    quoteVersion: quote.version,
    manufacturerId: quote.manufacturerId,
    quantity: quote.quantity,
    unitPrice: quote.unitPrice,
    totalPrice: quote.totalPrice,
    shippingEstimate: quote.shippingEstimate,
    toolingSetupCost: quote.toolingSetupCost,
    leadTimeDays: quote.leadTimeDays,
    materialProcessNotes: quote.materialProcessNotes,
    warrantyTerms: quote.warrantyTerms,
    terms: quote.terms,
    requirements,
    approvedSubstitutionIds: [...approvedSubstitutionIds].sort(),
  };

  const snapshot: AcceptedQuoteSnapshot = {
    ...body,
    approvedSubstitutionIds: Object.freeze([...body.approvedSubstitutionIds]),
    capturedAt,
    checksum: digest(stableStringify(body)),
  };

  return Object.freeze(snapshot);
};

export const snapshotChecksumMatches = (snapshot: AcceptedQuoteSnapshot): boolean => {
  const { capturedAt: _capturedAt, checksum, ...body } = snapshot;
  return digest(stableStringify(body)) === checksum;
};

export const assertSnapshotIntact = (snapshot: AcceptedQuoteSnapshot): void => {
  if (!snapshotChecksumMatches(snapshot)) {
    throw new InvariantViolationError(
      'accepted-quote-snapshot',
      'the captured order terms no longer match their checksum',
    );
  }
};
