/**
 * The two stretches of time a dashboard figure is read against.
 *
 * A trend caption is a claim about a comparison, so the comparison has to be
 * the one the words describe. The analytics header used to count a rolling
 * thirty-day window and say "vs the 30 days before"; the design says "vs last
 * month" (UIUX-109), and those are different sentences. Rather than relabel a
 * rolling window — which would have the page describe a comparison it was not
 * making — the comparison itself is calendar months, worked out here so both
 * panels and every test read the same definition.
 *
 * Months are taken in UTC, which is how the rows are stored. A shop reading the
 * page in Dhaka sees a month boundary a few hours off its own midnight; that is
 * a smaller untruth than two surfaces disagreeing about which month a Tuesday
 * belonged to.
 */

export interface ReportingPeriod {
  /** Inclusive. */
  readonly from: Date;
  /** Exclusive, so two adjacent periods cannot both claim the same instant. */
  readonly to: Date;
}

export interface MonthComparison {
  /** The first of this month, up to now. */
  readonly current: ReportingPeriod;
  /** The same stretch of last month — see the note on fairness below. */
  readonly previous: ReportingPeriod;
}

const startOfMonth = (at: Date): Date =>
  new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));

const startOfPreviousMonth = (at: Date): Date =>
  new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() - 1, 1));

/**
 * This month so far, against the same stretch of the month before.
 *
 * The earlier window is the *same elapsed time*, not the whole of last month.
 * Eight days of October against the whole of September is not a comparison —
 * it is a guaranteed fall, and it is what produced the "-100%" on the page
 * this was raised against.
 *
 * Where last month is the shorter one, the earlier window stops at its own end
 * rather than running into this month: the 31st of March has no answering date
 * in February, and borrowing days from March would count the same orders on
 * both sides of the comparison.
 */
export const monthToDate = (now: Date): MonthComparison => {
  const currentFrom = startOfMonth(now);
  const previousFrom = startOfPreviousMonth(now);

  const elapsed = now.getTime() - currentFrom.getTime();
  const previousTo = new Date(
    Math.min(previousFrom.getTime() + elapsed, currentFrom.getTime()),
  );

  return {
    current: { from: currentFrom, to: now },
    previous: { from: previousFrom, to: previousTo },
  };
};

/** Whether an instant falls inside a period. */
export const within = (at: Date, period: ReportingPeriod): boolean =>
  at.getTime() >= period.from.getTime() && at.getTime() < period.to.getTime();
