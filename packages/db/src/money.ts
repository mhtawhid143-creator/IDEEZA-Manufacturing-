import type { Money } from '@ideeza/domain';

/**
 * Money crosses the persistence boundary as an integer minor unit plus a
 * currency code. The database column is BigInt so that a large production run
 * in a low-denomination currency cannot overflow; the domain model uses a
 * number, so the conversion back is range checked rather than silently lossy.
 */
export interface StoredMoney {
  readonly minor: bigint;
  readonly currency: string;
}

export const toStoredMoney = (value: Money): StoredMoney => ({
  minor: BigInt(value.amountMinor),
  currency: value.currency.toUpperCase(),
});

export const fromStoredMoney = (stored: StoredMoney): Money => {
  if (
    stored.minor > BigInt(Number.MAX_SAFE_INTEGER) ||
    stored.minor < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new RangeError(
      `Stored amount ${stored.minor.toString()} exceeds the safe integer range and cannot be read into the domain money model.`,
    );
  }
  return { amountMinor: Number(stored.minor), currency: stored.currency };
};

export const minorOf = (value: Money): bigint => BigInt(value.amountMinor);
