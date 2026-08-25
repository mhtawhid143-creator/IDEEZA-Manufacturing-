/**
 * Branded identifier types.
 *
 * Every business object carries a distinct id type so that, for example, an
 * RfqId can never be passed where a QuoteId is expected. This matters most in
 * the shared boundary between the buyer and manufacturer domains, where the
 * same object graph is read by both sides under different permissions.
 */

declare const brand: unique symbol;

export type Branded<TValue extends string, TBrand extends string> = TValue & {
  readonly [brand]: TBrand;
};

export type UserId = Branded<string, 'UserId'>;
export type ManufacturerId = Branded<string, 'ManufacturerId'>;
export type ManufacturerMemberId = Branded<string, 'ManufacturerMemberId'>;
export type ProductId = Branded<string, 'ProductId'>;
export type PackageId = Branded<string, 'PackageId'>;
export type RequirementsId = Branded<string, 'RequirementsId'>;
export type RfqId = Branded<string, 'RfqId'>;
export type RfqRecipientId = Branded<string, 'RfqRecipientId'>;
export type RfqItemId = Branded<string, 'RfqItemId'>;
export type QuoteId = Branded<string, 'QuoteId'>;
export type QuoteItemId = Branded<string, 'QuoteItemId'>;
export type QuoteRevisionId = Branded<string, 'QuoteRevisionId'>;
export type SubstitutionId = Branded<string, 'SubstitutionId'>;
export type OrderId = Branded<string, 'OrderId'>;
export type ProductionStageId = Branded<string, 'ProductionStageId'>;
export type ProductionTaskId = Branded<string, 'ProductionTaskId'>;
export type InventoryItemId = Branded<string, 'InventoryItemId'>;
export type PaymentId = Branded<string, 'PaymentId'>;
export type PayoutId = Branded<string, 'PayoutId'>;
export type WithdrawalRequestId = Branded<string, 'WithdrawalRequestId'>;
export type MessageThreadId = Branded<string, 'MessageThreadId'>;
export type MessageId = Branded<string, 'MessageId'>;
export type DomainEventId = Branded<string, 'DomainEventId'>;
export type EvidenceId = Branded<string, 'EvidenceId'>;
export type RefundId = Branded<string, 'RefundId'>;
export type DisputeId = Branded<string, 'DisputeId'>;
export type NotificationId = Branded<string, 'NotificationId'>;
export type ReviewId = Branded<string, 'ReviewId'>;
export type FileId = Branded<string, 'FileId'>;

export const asId = <TId extends Branded<string, string>>(value: string): TId =>
  value as TId;

/** ISO-8601 timestamp string. */
export type IsoTimestamp = Branded<string, 'IsoTimestamp'>;

export const asTimestamp = (value: Date | string): IsoTimestamp =>
  (typeof value === 'string' ? value : value.toISOString()) as IsoTimestamp;
