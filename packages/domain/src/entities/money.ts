/**
 * Money is always stored as an integer minor unit plus an explicit currency, so
 * platform fee, tax and payout arithmetic never drifts through floating point.
 */
export interface Money {
  readonly amountMinor: number;
  readonly currency: string;
}

export const money = (amountMinor: number, currency: string): Money => ({
  amountMinor,
  currency,
});

export const addMoney = (left: Money, right: Money): Money => {
  if (left.currency !== right.currency) {
    throw new Error(`Cannot add ${left.currency} to ${right.currency}.`);
  }
  return money(left.amountMinor + right.amountMinor, left.currency);
};

export const subtractMoney = (left: Money, right: Money): Money => {
  if (left.currency !== right.currency) {
    throw new Error(`Cannot subtract ${right.currency} from ${left.currency}.`);
  }
  return money(left.amountMinor - right.amountMinor, left.currency);
};

export const multiplyMoney = (value: Money, factor: number): Money =>
  money(Math.round(value.amountMinor * factor), value.currency);
