import type {
  FileId,
  IsoTimestamp,
  InventoryItemId,
  ManufacturerId,
  QuoteId,
  QuoteItemId,
  QuoteRevisionId,
  RfqId,
  RfqItemId,
  SubstitutionId,
} from '../ids.js';
import type { QuoteStatus, SubstitutionStatus } from '../status/index.js';
import type { Money } from './money.js';

/**
 * A manufacturer response with every commercial term the buyer needs in order
 * to compare it against competing responses.
 *
 * A chat message may trigger the creation of one of these, but it can never be
 * one: the terms below are the only binding record.
 */
export interface Quote {
  readonly id: QuoteId;
  readonly rfqId: RfqId;
  readonly manufacturerId: ManufacturerId;
  readonly status: QuoteStatus;
  readonly version: number;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly totalPrice: Money;
  readonly toolingSetupCost?: Money | undefined;
  readonly shippingEstimate?: Money | undefined;
  readonly leadTimeDays: number;
  readonly materialProcessNotes: string;
  readonly warrantyTerms?: string | undefined;
  readonly terms: string;
  readonly attachments: readonly FileId[];
  readonly expiresAt: IsoTimestamp;
  readonly submittedAt?: IsoTimestamp | undefined;
  readonly acceptedAt?: IsoTimestamp | undefined;
  readonly createdAt: IsoTimestamp;
}

/** Line-level pricing inside a quote. */
export interface QuoteItem {
  readonly id: QuoteItemId;
  readonly quoteId: QuoteId;
  readonly rfqItemId?: RfqItemId | undefined;
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly lineTotal: Money;
}

/** An immutable record of a superseded set of quote terms. */
export interface QuoteRevision {
  readonly id: QuoteRevisionId;
  readonly quoteId: QuoteId;
  readonly version: number;
  readonly requestedByBuyerAt?: IsoTimestamp | undefined;
  readonly buyerNote?: string | undefined;
  readonly previousTerms: Readonly<Record<string, unknown>>;
  readonly createdAt: IsoTimestamp;
}

/**
 * A manufacturer-suggested replacement part, raised when the requested part is
 * unavailable. It must be approved by the buyer before production may rely on
 * it, and the approval is itself part of the documented order record.
 */
export interface Substitution {
  readonly id: SubstitutionId;
  readonly quoteId: QuoteId;
  readonly rfqItemId: RfqItemId;
  readonly status: SubstitutionStatus;
  readonly requestedPartReference: string;
  readonly suggestedPartName: string;
  readonly suggestedInventoryItemId?: InventoryItemId | undefined;
  readonly technicalJustification: string;
  readonly priceImpact: Money;
  readonly leadTimeImpactDays: number;
  readonly decidedAt?: IsoTimestamp | undefined;
  readonly createdAt: IsoTimestamp;
}
