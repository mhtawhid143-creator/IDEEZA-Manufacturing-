import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  assertSnapshotIntact,
  captureAcceptedQuoteSnapshot,
  snapshotChecksumMatches,
  type AcceptedQuoteSnapshot,
} from '@ideeza/domain';
import { buildQuote, now, requirements } from './fixtures.js';

const capture = (): AcceptedQuoteSnapshot =>
  captureAcceptedQuoteSnapshot({
    quote: buildQuote({ status: 'accepted' }),
    requirements: requirements(),
    approvedSubstitutionIds: ['sub_2', 'sub_1'],
    capturedAt: now,
  });

describe('accepted quote snapshot', () => {
  it('copies the agreed terms onto the order', () => {
    const snapshot = capture();
    expect(snapshot.quoteId).toBe('quote_1');
    expect(snapshot.totalPrice).toEqual({ amountMinor: 395000, currency: 'USD' });
    expect(snapshot.leadTimeDays).toBe(24);
    expect(snapshot.requirements.tolerance).toBe('+/-0.2mm');
  });

  it('is frozen, so the record cannot drift after the fact', () => {
    const snapshot = capture();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(() => {
      (snapshot as { leadTimeDays: number }).leadTimeDays = 2;
    }).toThrow(TypeError);
  });

  it('records substitution approvals deterministically', () => {
    expect(capture().approvedSubstitutionIds).toEqual(['sub_1', 'sub_2']);
    expect(capture().checksum).toBe(capture().checksum);
  });

  it('detects tampering through the checksum', () => {
    const snapshot = capture();
    const tampered = { ...snapshot, leadTimeDays: 2 };
    expect(snapshotChecksumMatches(snapshot)).toBe(true);
    expect(snapshotChecksumMatches(tampered)).toBe(false);
    expect(() => assertSnapshotIntact(tampered)).toThrow(InvariantViolationError);
  });

  it('refuses to capture a quote that was not accepted', () => {
    expect(() =>
      captureAcceptedQuoteSnapshot({
        quote: buildQuote({ status: 'revision_requested' }),
        requirements: requirements(),
        approvedSubstitutionIds: [],
        capturedAt: now,
      }),
    ).toThrow(InvariantViolationError);
  });
});
