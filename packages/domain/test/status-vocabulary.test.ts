import { describe, expect, it } from 'vitest';
import {
  CANONICAL_STAGES,
  DISPUTE_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  PRODUCTION_STAGES,
  QUOTE_STATUSES,
  REFUND_STATUSES,
  RFQ_RECIPIENT_STATUSES,
  RFQ_STATUSES,
  SUBSTITUTION_STATUSES,
} from '@ideeza/domain';

/**
 * These assertions are the contract with the approved business model. If a
 * status is renamed or added, this test must be updated deliberately.
 */
describe('status vocabulary', () => {
  it('locks the RFQ lifecycle', () => {
    expect(RFQ_STATUSES).toEqual(['draft', 'submitted', 'closed', 'withdrawn']);
  });

  it('locks per-manufacturer routing states', () => {
    expect(RFQ_RECIPIENT_STATUSES).toEqual([
      'routed',
      'viewed',
      'quoted',
      'declined',
      'expired',
    ]);
  });

  it('locks the quote lifecycle', () => {
    expect(QUOTE_STATUSES).toEqual([
      'draft',
      'submitted',
      'revision_requested',
      'revised',
      'accepted',
      'rejected',
      'expired',
      'withdrawn',
    ]);
  });

  it('locks substitution states', () => {
    expect(SUBSTITUTION_STATUSES).toEqual(['proposed', 'approved', 'rejected']);
  });

  it('locks the order lifecycle including the awaiting-payment state', () => {
    expect(ORDER_STATUSES).toEqual([
      'awaiting_payment',
      'confirmed',
      'in_production',
      'quality_check',
      'ready_to_ship',
      'shipped',
      'delivered',
      'completed',
      'cancel_requested',
      'cancelled',
      'refund_requested',
      'refunded',
      'partially_refunded',
      'disputed',
      'resolved',
    ]);
    expect(ORDER_STATUSES[0]).toBe('awaiting_payment');
  });

  it('locks money vocabulary', () => {
    expect(PAYMENT_STATUSES).toEqual([
      'initiated',
      'secured',
      'released',
      'refunded',
      'partially_refunded',
    ]);
    expect(PAYOUT_STATUSES).toEqual([
      'pending_release',
      'released',
      'refunded',
      'disputed',
    ]);
  });

  it('locks resolution vocabulary', () => {
    expect(REFUND_STATUSES).toEqual([
      'requested',
      'mfr_responded',
      'ops_review',
      'approved',
      'partial',
      'rejected',
    ]);
    expect(DISPUTE_STATUSES).toEqual([
      'open',
      'responded',
      'under_review',
      'resolved',
      'escalated',
    ]);
  });

  it('locks exactly ten canonical production stages in business order', () => {
    expect(PRODUCTION_STAGES).toEqual([
      'quote_accepted',
      'payment_secured',
      'files_under_review',
      'materials_confirmed',
      'in_production',
      'quality_check',
      'ready_to_ship',
      'shipped',
      'delivered',
      'completed',
    ]);
    expect(PRODUCTION_STAGES).toHaveLength(10);
    expect(CANONICAL_STAGES.map((stage) => stage.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(CANONICAL_STAGES.map((stage) => stage.label)).toEqual([
      'Quote Accepted',
      'Payment Secured',
      'Files Under Review',
      'Materials / Parts Confirmed',
      'In Production',
      'Quality Check',
      'Ready to Ship',
      'Shipped',
      'Delivered',
      'Completed',
    ]);
  });
});
