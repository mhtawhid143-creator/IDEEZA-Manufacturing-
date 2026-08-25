import type {
  IsoTimestamp,
  ManufacturerId,
  OrderId,
  PaymentId,
  PayoutId,
  QuoteId,
  UserId,
  WithdrawalRequestId,
} from '../ids.js';
import type { PaymentStatus, PayoutStatus, WithdrawalStatus } from '../status/index.js';
import type { Money } from './money.js';

export const PAYMENT_METHOD_KINDS = [
  'card',
  'paypal',
  'bank',
  'stablecoin',
  'platform_token',
] as const;
export type PaymentMethodKind = (typeof PAYMENT_METHOD_KINDS)[number];

/**
 * Buyer funding secured by the platform against one accepted quote.
 *
 * The order cannot be confirmed until this reaches "secured", and the money is
 * only released on a documented order event.
 */
export interface Payment {
  readonly id: PaymentId;
  readonly quoteId: QuoteId;
  readonly orderId?: OrderId | undefined;
  readonly buyerId: UserId;
  readonly status: PaymentStatus;
  readonly method: PaymentMethodKind;
  readonly goodsAmount: Money;
  readonly shippingAmount: Money;
  readonly taxAmount: Money;
  readonly platformFee: Money;
  readonly totalCharged: Money;
  readonly securedAt?: IsoTimestamp | undefined;
  readonly releasedAt?: IsoTimestamp | undefined;
  readonly createdAt: IsoTimestamp;
}

/** The manufacturer-facing side of the same money. */
export interface Payout {
  readonly id: PayoutId;
  readonly orderId: OrderId;
  readonly paymentId: PaymentId;
  readonly manufacturerId: ManufacturerId;
  readonly status: PayoutStatus;
  readonly orderAmount: Money;
  readonly platformFee: Money;
  readonly netAmount: Money;
  readonly releaseTriggerEventId?: string | undefined;
  readonly releasedAt?: IsoTimestamp | undefined;
  readonly createdAt: IsoTimestamp;
}

export interface WithdrawalRequest {
  readonly id: WithdrawalRequestId;
  readonly manufacturerId: ManufacturerId;
  readonly status: WithdrawalStatus;
  readonly amount: Money;
  readonly requestedAt: IsoTimestamp;
  readonly settledAt?: IsoTimestamp | undefined;
}
