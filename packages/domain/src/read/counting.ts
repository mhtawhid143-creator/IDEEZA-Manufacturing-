/**
 * Counts, in words that agree with themselves.
 *
 * Every screen that showed a count wrote its own unit beside it — `${quantity}
 * units`, `${count} Part`, `${total} Project` — and each of those is wrong for
 * exactly one value. "1 units" reads as a bug in the number, and "20 Part"
 * reads as a bug in the label; both make a reader distrust the figure they are
 * sitting next to (UIUX-137).
 *
 * So the count and its unit are formed together, once. The plural is derived by
 * adding "s" unless the caller gives one, because English is regular here often
 * enough that hand-writing both forms invites the two to disagree — and where it
 * is not regular ("part" / "parts" is, "entry" / "entries" is not) the caller
 * says so.
 */
export const counted = (
  count: number,
  singular: string,
  plural: string = `${singular}s`,
): string => `${count} ${count === 1 ? singular : plural}`;

/**
 * The unit on its own, for a column header or a caption where the number sits
 * somewhere else — a header that reads "Parts" over a column of counts, or
 * "1 part" in a sentence whose number is already written out.
 */
export const unitFor = (
  count: number,
  singular: string,
  plural: string = `${singular}s`,
): string => (count === 1 ? singular : plural);
