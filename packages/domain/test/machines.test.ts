import { describe, expect, it } from 'vitest';
import {
  InvalidTransitionError,
  applyTransition,
  canTransition,
  disputeMachine,
  isTerminal,
  paymentMachine,
  quoteMachine,
  refundMachine,
  rfqMachine,
  rfqRecipientMachine,
  substitutionMachine,
} from '@ideeza/domain';

const quoteContext = {
  acceptedQuoteCountOnRfq: 0,
  pendingSubstitutionCount: 0,
};

describe('request lifecycle', () => {
  it('allows draft to submitted and submitted to closed', () => {
    expect(applyTransition(rfqMachine, 'draft', 'submitted', undefined)).toBe('submitted');
    expect(applyTransition(rfqMachine, 'submitted', 'closed', undefined)).toBe('closed');
  });

  it('refuses to reopen a closed request', () => {
    expect(() => applyTransition(rfqMachine, 'closed', 'submitted', undefined)).toThrow(
      InvalidTransitionError,
    );
  });

  it('treats closed and withdrawn as terminal', () => {
    expect(isTerminal(rfqMachine, 'closed')).toBe(true);
    expect(isTerminal(rfqMachine, 'withdrawn')).toBe(true);
    expect(isTerminal(rfqMachine, 'submitted')).toBe(false);
  });
});

describe('per-manufacturer routing lifecycle', () => {
  it('lets a manufacturer decline before quoting, which is valid pre-order', () => {
    expect(applyTransition(rfqRecipientMachine, 'routed', 'declined', undefined)).toBe(
      'declined',
    );
    expect(applyTransition(rfqRecipientMachine, 'viewed', 'declined', undefined)).toBe(
      'declined',
    );
  });

  it('refuses to un-decline or to quote after declining', () => {
    expect(() =>
      applyTransition(rfqRecipientMachine, 'declined', 'quoted', undefined),
    ).toThrow(InvalidTransitionError);
  });
});

describe('quote lifecycle', () => {
  it('supports the revision loop', () => {
    expect(applyTransition(quoteMachine, 'draft', 'submitted', quoteContext)).toBe(
      'submitted',
    );
    expect(
      applyTransition(quoteMachine, 'submitted', 'revision_requested', quoteContext),
    ).toBe('revision_requested');
    expect(
      applyTransition(quoteMachine, 'revision_requested', 'revised', quoteContext),
    ).toBe('revised');
    expect(applyTransition(quoteMachine, 'revised', 'accepted', quoteContext)).toBe(
      'accepted',
    );
  });

  it('refuses to accept a draft quote', () => {
    expect(() => applyTransition(quoteMachine, 'draft', 'accepted', quoteContext)).toThrow(
      InvalidTransitionError,
    );
  });

  it('refuses to revive an expired quote', () => {
    expect(() =>
      applyTransition(quoteMachine, 'expired', 'accepted', quoteContext),
    ).toThrow(InvalidTransitionError);
  });
});

describe('substitution lifecycle', () => {
  it('is decided once and only once', () => {
    expect(applyTransition(substitutionMachine, 'proposed', 'approved', undefined)).toBe(
      'approved',
    );
    expect(() =>
      applyTransition(substitutionMachine, 'approved', 'rejected', undefined),
    ).toThrow(InvalidTransitionError);
  });
});

describe('payment lifecycle', () => {
  it('secures then releases', () => {
    expect(applyTransition(paymentMachine, 'initiated', 'secured', undefined)).toBe(
      'secured',
    );
    expect(applyTransition(paymentMachine, 'secured', 'released', undefined)).toBe(
      'released',
    );
  });

  it('cannot release money that was never secured', () => {
    expect(canTransition(paymentMachine, 'initiated', 'released', undefined)).toBe(false);
  });
});

describe('resolution lifecycles', () => {
  const opsContext = { actorRole: 'ops_admin' as const, evidenceCount: 2 };

  it('lets operations decide a refund after a manufacturer response', () => {
    expect(applyTransition(refundMachine, 'requested', 'mfr_responded', opsContext)).toBe(
      'mfr_responded',
    );
    expect(applyTransition(refundMachine, 'mfr_responded', 'partial', opsContext)).toBe(
      'partial',
    );
  });

  it('refuses a refund decision taken by the manufacturer', () => {
    expect(() =>
      applyTransition(refundMachine, 'mfr_responded', 'approved', {
        actorRole: 'manufacturer',
        evidenceCount: 2,
      }),
    ).toThrow(InvalidTransitionError);
  });

  it('refuses to resolve a dispute with no evidence on the record', () => {
    expect(() =>
      applyTransition(disputeMachine, 'under_review', 'resolved', {
        actorRole: 'ops_admin',
        evidenceCount: 0,
      }),
    ).toThrow(/without evidence/);
  });

  it('resolves a dispute when operations acts on documented evidence', () => {
    expect(applyTransition(disputeMachine, 'under_review', 'resolved', opsContext)).toBe(
      'resolved',
    );
  });
});
