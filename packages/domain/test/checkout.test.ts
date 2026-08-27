import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  asId,
  assertDiscountWithinGoods,
  assertMethodSupported,
  assertOrderIsPayable,
  checkoutTotalMinor,
  readPromoCode,
  type OrderId,
} from '../src/index.js';

const order = asId<OrderId>('order_1');
const now = new Date('2026-06-01T00:00:00.000Z');

describe('paying for an order', () => {
  it('lets an order that is awaiting payment be paid', () => {
    expect(() => assertOrderIsPayable(order, 'awaiting_payment')).not.toThrow();
  });

  it('refuses an order that is already confirmed or finished', () => {
    for (const status of ['confirmed', 'in_production', 'cancelled', 'completed'] as const) {
      expect(() => assertOrderIsPayable(order, status)).toThrow(InvariantViolationError);
    }
  });

  it('accepts only the methods the platform holds funds through', () => {
    for (const method of ['card', 'paypal', 'stablecoin', 'platform_token', 'bank'] as const) {
      expect(() => assertMethodSupported(method)).not.toThrow();
    }
  });

  it('adds the lines and takes the discount off', () => {
    expect(
      checkoutTotalMinor({
        goodsMinor: 100_000,
        shippingMinor: 8_400,
        taxMinor: 0,
        platformFeeMinor: 3_000,
        discountMinor: 10_000,
      }),
    ).toBe(101_400);
  });

  it('refuses a discount larger than the goods', () => {
    expect(() => assertDiscountWithinGoods(1_000, 5_000)).not.toThrow();
    expect(() => assertDiscountWithinGoods(6_000, 5_000)).toThrow(InvariantViolationError);
    expect(() => assertDiscountWithinGoods(-1, 5_000)).toThrow(/whole amount/);
  });
});

describe('reading a coupon', () => {
  const usable = {
    active: true,
    redeemedCount: 0,
    percentOff: 10,
  };

  it('takes a percentage off the goods', () => {
    const verdict = readPromoCode(usable, 100_000, 'USD', now);
    expect(verdict.usable).toBe(true);
    expect(verdict.discountMinor).toBe(10_000);
  });

  it('refuses a code that does not exist', () => {
    expect(readPromoCode(undefined, 100_000, 'USD', now).refusal).toBe('unknown');
  });

  it('refuses a code that is switched off, unstarted or expired', () => {
    expect(readPromoCode({ ...usable, active: false }, 100_000, 'USD', now).refusal).toBe(
      'inactive',
    );
    expect(
      readPromoCode(
        { ...usable, startsAt: new Date('2026-07-01T00:00:00.000Z') },
        100_000,
        'USD',
        now,
      ).refusal,
    ).toBe('not_started');
    expect(
      readPromoCode(
        { ...usable, expiresAt: new Date('2026-05-01T00:00:00.000Z') },
        100_000,
        'USD',
        now,
      ).refusal,
    ).toBe('expired');
  });

  it('refuses a code that has been used up', () => {
    expect(
      readPromoCode(
        { ...usable, maxRedemptions: 5, redeemedCount: 5 },
        100_000,
        'USD',
        now,
      ).refusal,
    ).toBe('exhausted');
  });

  it('refuses a code below its minimum spend', () => {
    expect(
      readPromoCode({ ...usable, minimumSpendMinor: 200_000 }, 100_000, 'USD', now).refusal,
    ).toBe('below_minimum');
  });

  it('refuses a fixed-amount code issued in another currency', () => {
    expect(
      readPromoCode(
        { active: true, redeemedCount: 0, amountOffMinor: 5_000, currency: 'EUR' },
        100_000,
        'USD',
        now,
      ).refusal,
    ).toBe('wrong_currency');
  });

  it('never discounts more than the goods are worth', () => {
    const verdict = readPromoCode(
      { active: true, redeemedCount: 0, amountOffMinor: 500_000 },
      100_000,
      'USD',
      now,
    );
    expect(verdict.discountMinor).toBe(100_000);
  });
});
