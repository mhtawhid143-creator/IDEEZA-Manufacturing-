import { quoteLandedTotalMinor } from '@ideeza/domain';

/**
 * Money crosses into the screens as a string in major units.
 *
 * The database holds integer minor units and the domain refuses floats, so the
 * conversion happens once, here, on the server side of a page.
 */
export const major = (minor: bigint | null): string =>
  minor === null ? '—' : (Number(minor) / 100).toFixed(2);

export const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

/**
 * A quote's full cost: the units, plus shipping and tooling when quoted.
 *
 * The arithmetic itself is the domain's `quoteLandedTotalMinor`, because the
 * manufacturer's own screen shows the same figure while it writes the quote and
 * the two must not differ by a rounding or a forgotten line. This is only the
 * conversion from the stored bigints.
 */
export const landedTotalMinor = (quote: {
  readonly quantity: number;
  readonly unitPriceMinor: bigint;
  readonly shippingEstimateMinor: bigint | null;
  readonly toolingSetupCostMinor: bigint | null;
}): bigint =>
  BigInt(
    quoteLandedTotalMinor({
      quantity: quote.quantity,
      unitPriceMinor: Number(quote.unitPriceMinor),
      shippingEstimateMinor:
        quote.shippingEstimateMinor === null ? null : Number(quote.shippingEstimateMinor),
      toolingSetupCostMinor:
        quote.toolingSetupCostMinor === null ? null : Number(quote.toolingSetupCostMinor),
    }),
  );
