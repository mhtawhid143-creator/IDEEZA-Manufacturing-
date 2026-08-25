import type {
  IsoTimestamp,
  ManufacturerId,
  OrderId,
  PaymentId,
  ProductionStageId,
  ProductionTaskId,
  QuoteId,
  RfqId,
  UserId,
} from '../ids.js';
import type {
  OrderStatus,
  ProductionProgressStatus,
  ProductionStageKey,
} from '../status/index.js';
import type { Money } from './money.js';
import type { PostalAddress } from './party.js';
import type { ManufacturingRequirements } from './product.js';

/**
 * The frozen copy of the accepted quote taken at order creation.
 *
 * Disputes are decided on the documented record, so the order must not read
 * live quote rows: it carries its own immutable copy of what both sides agreed.
 */
export interface AcceptedQuoteSnapshot {
  readonly quoteId: QuoteId;
  readonly quoteVersion: number;
  readonly manufacturerId: ManufacturerId;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly totalPrice: Money;
  readonly shippingEstimate?: Money | undefined;
  readonly toolingSetupCost?: Money | undefined;
  readonly leadTimeDays: number;
  readonly materialProcessNotes: string;
  readonly warrantyTerms?: string | undefined;
  readonly terms: string;
  readonly requirements: ManufacturingRequirements;
  readonly approvedSubstitutionIds: readonly string[];
  readonly capturedAt: IsoTimestamp;
  readonly checksum: string;
}

export interface ManufacturingOrder {
  readonly id: OrderId;
  readonly rfqId: RfqId;
  readonly buyerId: UserId;
  readonly manufacturerId: ManufacturerId;
  readonly status: OrderStatus;
  readonly acceptedQuote: AcceptedQuoteSnapshot;
  readonly paymentId?: PaymentId | undefined;
  readonly deliveryAddress: PostalAddress;
  readonly reviewWindowEndsAt?: IsoTimestamp | undefined;
  readonly confirmedAt?: IsoTimestamp | undefined;
  readonly deliveredAt?: IsoTimestamp | undefined;
  readonly completedAt?: IsoTimestamp | undefined;
  readonly createdAt: IsoTimestamp;
}

/** One of the ten canonical stages, tracked per order. */
export interface ProductionStage {
  readonly id: ProductionStageId;
  readonly orderId: OrderId;
  readonly key: ProductionStageKey;
  readonly position: number;
  readonly status: ProductionProgressStatus;
  readonly startedAt?: IsoTimestamp | undefined;
  readonly completedAt?: IsoTimestamp | undefined;
  readonly note?: string | undefined;
}

/**
 * A manufacturer-defined activity nested inside a canonical stage, which is how
 * shop-floor detail is represented without inventing new stages.
 */
export interface ProductionTask {
  readonly id: ProductionTaskId;
  readonly orderId: OrderId;
  readonly stageKey: ProductionStageKey;
  readonly label: string;
  readonly position: number;
  readonly status: ProductionProgressStatus;
  readonly startedAt?: IsoTimestamp | undefined;
  readonly completedAt?: IsoTimestamp | undefined;
}
