import { describe, expect, it } from 'vitest';
import {
  QUOTE_EXPIRING_WITHIN_DAYS,
  QUOTE_LIFECYCLE,
  QUOTE_LIFECYCLE_LABEL,
  QUOTE_REASON_LABEL,
  quoteLifecycle,
  quoteReason,
} from '../src/index.js';

const NOW = new Date('2026-09-09T12:00:00.000Z');
const inDays = (days: number): Date =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

describe('where a quote got to', () => {
  it('is exactly one of five, for every stored status', () => {
    for (const status of [
      'draft',
      'submitted',
      'revision_requested',
      'revised',
      'accepted',
      'rejected',
      'expired',
      'withdrawn',
    ] as const) {
      for (const expired of [false, true]) {
        const value = quoteLifecycle({ status, expired });
        expect(QUOTE_LIFECYCLE).toContain(value);
        expect(QUOTE_LIFECYCLE_LABEL[value].length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps an accepted quote accepted after its validity date', () => {
    // The order it opened does not expire with the price that opened it.
    expect(quoteLifecycle({ status: 'accepted', expired: true })).toBe('accepted');
  });

  it('reads an open quote past its date as expired, however it is stored', () => {
    expect(quoteLifecycle({ status: 'submitted', expired: true })).toBe('expired');
    expect(quoteLifecycle({ status: 'revised', expired: true })).toBe('expired');
  });

  it('does not promote a revision request into a state of its own', () => {
    // A quote the buyer asked to see again is still a quote with the buyer.
    // Promoting it would split "Quoted" and break the counts above the table.
    expect(quoteLifecycle({ status: 'revision_requested', expired: false })).toBe('quoted');
  });

  it('says who declined', () => {
    // The request side uses "Declined" for the shop turning work down. One word
    // for two actors' decisions would be worse than a longer label.
    expect(QUOTE_LIFECYCLE_LABEL.declined).toMatch(/buyer/);
  });
});

describe('why a quoted row wants attention', () => {
  it('is a revision the buyer asked for', () => {
    expect(
      quoteReason({
        status: 'revision_requested',
        expiresAt: inDays(30),
        expired: false,
        now: NOW,
      }),
    ).toBe('revision');
  });

  it('is a clock running out, inside the shared window', () => {
    expect(
      quoteReason({
        status: 'submitted',
        expiresAt: inDays(QUOTE_EXPIRING_WITHIN_DAYS - 1),
        expired: false,
        now: NOW,
      }),
    ).toBe('expiring');
    expect(
      quoteReason({
        status: 'submitted',
        expiresAt: inDays(QUOTE_EXPIRING_WITHIN_DAYS + 5),
        expired: false,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('is nothing at all once the quote is settled or gone', () => {
    for (const status of ['accepted', 'rejected', 'withdrawn', 'expired'] as const) {
      expect(
        quoteReason({ status, expiresAt: inDays(1), expired: false, now: NOW }),
      ).toBeNull();
    }
    // And an already-expired quote is not "expiring": it has expired.
    expect(
      quoteReason({
        status: 'submitted',
        expiresAt: inDays(-1),
        expired: true,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('names both reasons it can give', () => {
    expect(QUOTE_REASON_LABEL.revision.length).toBeGreaterThan(0);
    expect(QUOTE_REASON_LABEL.expiring.length).toBeGreaterThan(0);
  });
});
