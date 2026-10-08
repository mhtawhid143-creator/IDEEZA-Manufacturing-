import { describe, expect, it } from 'vitest';
import { DOMAIN_EVENT_KINDS, activityLabel, ACTIVITY_LABEL } from '../src/index.js';

/**
 * UIUX-123. The activity feed read "refund manufacturer challenged" — a stored
 * token with its underscores knocked out, in lower case, beside properly
 * written lines. The cause was a hand-written map in a screen with nothing
 * checking it against the kinds that exist, so a kind added later simply fell
 * through. Twelve had.
 *
 * The vocabulary is in the domain now and these are what hold it there: every
 * kind has a line, every line is past tense, and nothing reaches a reader as a
 * machine name.
 */
describe('how an event is said in the activity feed', () => {
  it('has a line for every kind the platform can record', () => {
    const missing = DOMAIN_EVENT_KINDS.filter((kind) => ACTIVITY_LABEL[kind] === undefined);
    expect(missing).toEqual([]);
  });

  it('starts every line with a capital, so none reads as a stored token', () => {
    for (const kind of DOMAIN_EVENT_KINDS) {
      const label = ACTIVITY_LABEL[kind];
      expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
    }
  });

  it('never leaves an underscore in a line a person reads', () => {
    for (const kind of DOMAIN_EVENT_KINDS) {
      expect(ACTIVITY_LABEL[kind]).not.toMatch(/_/);
    }
  });

  it('writes every line in the past, because the feed is a log of what happened', () => {
    // The design's own rule: "<noun> <past-tense verb>". A line in the present
    // ("Part running low", "Part out of stock") reads as a standing state and
    // sits oddly beside seven lines that report a moment.
    for (const kind of DOMAIN_EVENT_KINDS) {
      expect(ACTIVITY_LABEL[kind]).not.toMatch(/\b\w+ing\b/);
      expect(ACTIVITY_LABEL[kind]).not.toMatch(/\b(is|are|cannot|will)\b/);
    }
  });

  it('reads the stored spelling as well as the domain one', () => {
    // The domain writes `refund.manufacturer_challenged`; the database column
    // stores `refund_manufacturer_challenged`. One reader, both spellings, so
    // a screen cannot be wired to the wrong one.
    expect(activityLabel('refund.manufacturer_challenged')).toBe('Refund challenged');
    expect(activityLabel('refund_manufacturer_challenged')).toBe('Refund challenged');
  });

  it('capitalises a kind it has never seen rather than printing it raw', () => {
    expect(activityLabel('something_nobody_has_added_yet')).toBe(
      'Something nobody has added yet',
    );
  });
});
