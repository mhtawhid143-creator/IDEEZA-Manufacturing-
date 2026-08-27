import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  MAX_RFQ_RECIPIENTS,
  asId,
  assertDeadlineIsInTheFuture,
  assertRecipientsSelected,
  assertVolumeTiersUsable,
  type ManufacturerId,
} from '../src/index.js';

const manufacturer = (suffix: string): ManufacturerId =>
  asId<ManufacturerId>(`mfr_${suffix}`);

describe('sending a request to manufacturers', () => {
  it('needs at least one recipient', () => {
    expect(() => assertRecipientsSelected([])).toThrow(InvariantViolationError);
    expect(() => assertRecipientsSelected([manufacturer('a')])).not.toThrow();
  });

  it('routes one request to many manufacturers, up to the limit', () => {
    const many = Array.from({ length: MAX_RFQ_RECIPIENTS }, (_value, index) =>
      manufacturer(String(index)),
    );
    expect(() => assertRecipientsSelected(many)).not.toThrow();
    expect(() =>
      assertRecipientsSelected([...many, manufacturer('one-too-many')]),
    ).toThrow(/at most 10/);
  });

  it('refuses the same manufacturer twice', () => {
    expect(() =>
      assertRecipientsSelected([manufacturer('a'), manufacturer('a')]),
    ).toThrow(/cannot receive one request twice/);
  });

  it('accepts distinct, whole volume tiers', () => {
    expect(() => assertVolumeTiersUsable([])).not.toThrow();
    expect(() => assertVolumeTiersUsable([250, 500, 1000])).not.toThrow();
  });

  it('refuses a tier that is not a production quantity', () => {
    expect(() => assertVolumeTiersUsable([0])).toThrow(InvariantViolationError);
    expect(() => assertVolumeTiersUsable([-10])).toThrow(InvariantViolationError);
    expect(() => assertVolumeTiersUsable([12.5])).toThrow(InvariantViolationError);
  });

  it('refuses the same tier twice', () => {
    expect(() => assertVolumeTiersUsable([500, 500])).toThrow(/listed twice/);
  });

  it('refuses a response deadline that has already passed', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    expect(() => assertDeadlineIsInTheFuture(undefined, now)).not.toThrow();
    expect(() =>
      assertDeadlineIsInTheFuture(new Date('2026-06-10T00:00:00.000Z'), now),
    ).not.toThrow();
    expect(() =>
      assertDeadlineIsInTheFuture(new Date('2026-05-20T00:00:00.000Z'), now),
    ).toThrow(InvariantViolationError);
    expect(() => assertDeadlineIsInTheFuture(now, now)).toThrow(
      /already passed/,
    );
  });
});
