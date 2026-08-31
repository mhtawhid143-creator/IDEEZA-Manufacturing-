/**
 * Money, in words a person can read at a glance.
 *
 * The domain keeps every amount as an integer number of minor units, which is
 * the only safe way to hold money and the wrong way to show it. Turning those
 * units into major ones with `toFixed(2)` was what every screen did, and it
 * produced `103017.11` — a figure the eye has to count digits through before it
 * knows whether the shop is owed a hundred thousand or ten. Grouped, the same
 * figure reads in one glance.
 *
 * Grouping is `en-US`, which is what the rest of the interface is written in;
 * the tables that hold these figures already set `font-variant-numeric:
 * tabular-nums`, so grouped amounts still line up in a column.
 *
 * The currency code is deliberately not joined on here. Screens place it
 * differently — beside the figure, above it, in a column header — and a
 * formatter that decided would take that choice away.
 */
const GROUPED = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Minor units to a grouped major-unit string: `10301711` → `103,017.11`.
 *
 * A negative amount keeps its sign in front of the digits rather than inside
 * them, so a refund reads `-1,200.00` and not `1,-200.00` in any locale that
 * would place it differently.
 */
export const majorAmount = (minor: number): string =>
  `${minor < 0 ? '-' : ''}${GROUPED.format(Math.abs(minor) / 100)}`;

/**
 * A plain count, grouped the same way: `11200` → `11,200`.
 *
 * For quantities — units ordered, parts in stock — where the fractional part
 * would be noise.
 */
const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const wholeAmount = (value: number): string => WHOLE.format(value);
