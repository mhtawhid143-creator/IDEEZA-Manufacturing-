import { describe, expect, it } from 'vitest';
import { monthToDate } from '../src/index.js';

const at = (iso: string): Date => new Date(iso);

/**
 * UIUX-109. The dashboard said "vs the 30 days before" where the design says
 * "vs last month", and the two are not the same sentence: the figure was a
 * rolling thirty-day window. Changing the words alone would have made the
 * caption describe a comparison the page was not making, so the comparison
 * moved to calendar months and these pin what that means.
 */
describe('this month against last month', () => {
  it('runs from the first of the month to now', () => {
    const period = monthToDate(at('2026-10-08T13:45:00.000Z'));

    expect(period.current.from.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(period.current.to.toISOString()).toBe('2026-10-08T13:45:00.000Z');
  });

  it('compares the same stretch of last month, not the whole of it', () => {
    // Eight days into October is measured against the first eight days of
    // September. A part month against a whole one is not a comparison, it is a
    // guaranteed fall — which is exactly the "-100%" the reviewer was shown.
    const period = monthToDate(at('2026-10-08T13:45:00.000Z'));

    expect(period.previous.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(period.previous.to.toISOString()).toBe('2026-09-08T13:45:00.000Z');
  });

  it('crosses the turn of the year', () => {
    const period = monthToDate(at('2026-01-05T09:00:00.000Z'));

    expect(period.current.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(period.previous.from.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(period.previous.to.toISOString()).toBe('2025-12-05T09:00:00.000Z');
  });

  it('never runs the earlier window past the end of its own month', () => {
    // The 31st of March has no answering date in February. The window stops
    // where February stops rather than borrowing days from March, which would
    // count the same orders in both halves of the comparison.
    const period = monthToDate(at('2026-03-31T18:00:00.000Z'));

    expect(period.previous.from.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(period.previous.to.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('gives the earlier window no width on the first instant of a month', () => {
    const period = monthToDate(at('2026-07-01T00:00:00.000Z'));

    expect(period.current.from.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(period.previous.from.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(period.previous.to.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });
});
