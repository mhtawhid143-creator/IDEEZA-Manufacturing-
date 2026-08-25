import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES,
  PERMISSION_MATRIX,
  PermissionDeniedError,
  assertCan,
  can,
  capabilitiesFor,
  type Capability,
} from '@ideeza/domain';
import { manufacturerA } from './fixtures.js';

describe('permission matrix', () => {
  it('covers every capability exactly once', () => {
    expect(Object.keys(PERMISSION_MATRIX).sort()).toEqual([...CAPABILITIES].sort());
  });

  it('denies by default for an unknown capability', () => {
    expect(can('buyer', 'nonexistent.capability' as Capability)).toBe(false);
  });

  it('keeps buyer-only actions away from the manufacturer', () => {
    for (const capability of [
      'rfq.create',
      'rfq.withdraw',
      'quote.accept',
      'checkout.pay',
      'substitution.decide',
      'delivery.confirm',
      'refund.request',
    ] as const) {
      expect(can('buyer', capability)).toBe(true);
      expect(can('manufacturer', capability)).toBe(false);
    }
  });

  it('keeps manufacturer-only actions away from the buyer', () => {
    for (const capability of [
      'rfq.decline',
      'quote.create',
      'quote.revise',
      'substitution.suggest',
      'production.update',
      'inventory.read',
      'inventory.write',
      'payout.withdraw',
    ] as const) {
      expect(can('manufacturer', capability)).toBe(true);
      expect(can('buyer', capability)).toBe(false);
    }
  });

  it('reserves cancellation, refund decisions, dispute resolution and release for operations', () => {
    for (const capability of [
      'cancellation.decide',
      'refund.decide',
      'dispute.resolve',
      'payout.release',
    ] as const) {
      expect(can('ops_admin', capability)).toBe(true);
      expect(can('buyer', capability)).toBe(false);
      expect(can('manufacturer', capability)).toBe(false);
    }
  });

  it('never exposes any inventory capability to a buyer', () => {
    const buyerCapabilities = capabilitiesFor('buyer');
    expect(buyerCapabilities.some((capability) => capability.startsWith('inventory.'))).toBe(
      false,
    );
  });

  it('throws for a denied capability', () => {
    expect(() => assertCan({ role: 'manufacturer', manufacturerId: manufacturerA }, 'quote.accept')).toThrow(
      PermissionDeniedError,
    );
  });

  it('requires a manufacturer actor to carry the manufacturer it acts for', () => {
    expect(() => assertCan({ role: 'manufacturer' }, 'quote.create')).toThrow(
      /must carry the manufacturer/,
    );
    expect(() =>
      assertCan({ role: 'manufacturer', manufacturerId: manufacturerA }, 'quote.create'),
    ).not.toThrow();
  });
});
