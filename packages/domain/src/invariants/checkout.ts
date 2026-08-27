import { InvariantViolationError } from '../errors.js';
import type { OrderId } from '../ids.js';
import type { OrderStatus } from '../status/index.js';
import type { PaymentMethodKind } from '../entities/settlement.js';

/**
 * Only an order that is waiting for money may be paid.
 *
 * An order that is already confirmed has funds held against it, and an order
 * that is cancelled or in an issue state is not a checkout.
 */
export const assertOrderIsPayable = (orderId: OrderId, status: OrderStatus): void => {
  if (status !== 'awaiting_payment') {
    throw new InvariantViolationError(
      'OrderIsPayable',
      `order ${orderId} is ${status}, so there is nothing to pay`,
    );
  }
};

/** The methods the platform can hold funds through. */
export const CHECKOUT_METHODS: readonly PaymentMethodKind[] = Object.freeze([
  'card',
  'paypal',
  'stablecoin',
  'platform_token',
  'bank',
]);

export const assertMethodSupported = (method: PaymentMethodKind): void => {
  if (!CHECKOUT_METHODS.includes(method)) {
    throw new InvariantViolationError(
      'CheckoutMethodSupported',
      `${method} is not a payment method this platform holds funds through`,
    );
  }
};

export interface CheckoutLines {
  /** The goods, exactly as the accepted quote priced them. */
  readonly goodsMinor: number;
  readonly shippingMinor: number;
  readonly taxMinor: number;
  readonly platformFeeMinor: number;
  readonly discountMinor: number;
}

/**
 * What the buyer is charged.
 *
 * One function, used by the summary the buyer reads and by the payment that is
 * written, so the two can never disagree.
 */
export const checkoutTotalMinor = (lines: CheckoutLines): number =>
  lines.goodsMinor +
  lines.shippingMinor +
  lines.taxMinor +
  lines.platformFeeMinor -
  lines.discountMinor;

/**
 * A discount can never exceed what is being bought, and never touches shipping,
 * tax or the platform fee: it comes off the goods.
 */
export const assertDiscountWithinGoods = (
  discountMinor: number,
  goodsMinor: number,
): void => {
  if (!Number.isInteger(discountMinor) || discountMinor < 0) {
    throw new InvariantViolationError(
      'DiscountIsAPositiveAmount',
      `discount ${discountMinor} is not a whole amount of minor units`,
    );
  }
  if (discountMinor > goodsMinor) {
    throw new InvariantViolationError(
      'DiscountWithinGoods',
      `a discount of ${discountMinor} is larger than the goods total of ${goodsMinor}`,
    );
  }
};

/** Why a promotion code cannot be used, when it cannot. */
export const PROMO_REFUSALS = [
  'unknown',
  'inactive',
  'not_started',
  'expired',
  'exhausted',
  'below_minimum',
  'wrong_currency',
] as const;
export type PromoRefusal = (typeof PROMO_REFUSALS)[number];

export interface PromoCandidate {
  readonly active: boolean;
  readonly startsAt?: Date | undefined;
  readonly expiresAt?: Date | undefined;
  readonly maxRedemptions?: number | undefined;
  readonly redeemedCount: number;
  readonly minimumSpendMinor?: number | undefined;
  readonly percentOff?: number | undefined;
  readonly amountOffMinor?: number | undefined;
  readonly currency?: string | undefined;
}

export interface PromoVerdict {
  readonly usable: boolean;
  readonly refusal?: PromoRefusal | undefined;
  /** The amount it takes off the goods, once it is usable. */
  readonly discountMinor: number;
}

/**
 * Reads a promotion against what is being bought.
 *
 * Pure, so the field that says "invalid" and the payment that refuses it are
 * the same decision.
 */
export const readPromoCode = (
  candidate: PromoCandidate | undefined,
  goodsMinor: number,
  currency: string,
  now: Date,
): PromoVerdict => {
  const refuse = (refusal: PromoRefusal): PromoVerdict => ({
    usable: false,
    refusal,
    discountMinor: 0,
  });

  if (candidate === undefined) return refuse('unknown');
  if (!candidate.active) return refuse('inactive');
  if (candidate.startsAt !== undefined && candidate.startsAt.getTime() > now.getTime()) {
    return refuse('not_started');
  }
  if (candidate.expiresAt !== undefined && candidate.expiresAt.getTime() <= now.getTime()) {
    return refuse('expired');
  }
  if (
    candidate.maxRedemptions !== undefined &&
    candidate.redeemedCount >= candidate.maxRedemptions
  ) {
    return refuse('exhausted');
  }
  if (
    candidate.minimumSpendMinor !== undefined &&
    goodsMinor < candidate.minimumSpendMinor
  ) {
    return refuse('below_minimum');
  }
  if (
    candidate.amountOffMinor !== undefined &&
    candidate.currency !== undefined &&
    candidate.currency.toUpperCase() !== currency.toUpperCase()
  ) {
    return refuse('wrong_currency');
  }

  const percentDiscount =
    candidate.percentOff === undefined
      ? 0
      : Math.floor((goodsMinor * candidate.percentOff) / 100);
  const amountDiscount = candidate.amountOffMinor ?? 0;
  const discountMinor = Math.min(goodsMinor, Math.max(percentDiscount, amountDiscount));

  return { usable: discountMinor > 0, refusal: undefined, discountMinor };
};
