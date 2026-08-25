import { describe, expect, it } from 'vitest';
import {
  acceptQuoteSchema,
  openDisputeSchema,
  productionStageKeySchema,
  requestRefundSchema,
  secureCheckoutSchema,
  submitQuoteSchema,
  submitRfqSchema,
  updateStageProgressSchema,
} from '@ideeza/types';

const money = (amountMinor: number) => ({ amountMinor, currency: 'USD' });

const requirements = {
  files: [
    {
      id: 'file_1',
      name: 'main-board.zip',
      revision: 1,
      contentHash: 'abc123',
      byteSize: 2048,
      uploadedAt: '2026-05-17T10:00:00.000Z',
    },
  ],
  bom: [],
  quantity: 500,
  material: 'FR-4',
  manufacturingMethod: 'PCB fabrication + SMT assembly',
  tolerance: '+/-0.2mm',
  leadTimeDays: 18,
  shippingRequirement: 'Courier, tracked',
  assembly: 'smt' as const,
  qualityCheckRequirement: 'Optical inspection',
  substitutionPolicy: 'with_approval' as const,
};

describe('request submission', () => {
  it('accepts one request routed to several manufacturers', () => {
    const parsed = submitRfqSchema.parse({
      packageId: 'pkg_1',
      requirements,
      quantity: 500,
      deliveryAddress: { line1: '20/3, Sector 9', city: 'Dhaka', countryCode: 'bd' },
      manufacturerIds: ['mfr_a', 'mfr_b', 'mfr_c'],
    });

    expect(parsed.manufacturerIds).toHaveLength(3);
    expect(parsed.deliveryAddress.countryCode).toBe('BD');
    expect(parsed.volumeTiers).toEqual([]);
  });

  it('refuses a request with no recipient', () => {
    const result = submitRfqSchema.safeParse({
      packageId: 'pkg_1',
      requirements,
      quantity: 500,
      deliveryAddress: { line1: 'x', city: 'y', countryCode: 'BD' },
      manufacturerIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('refuses requirements that omit the production boundary fields', () => {
    const { tolerance: _tolerance, ...withoutTolerance } = requirements;
    const result = submitRfqSchema.safeParse({
      packageId: 'pkg_1',
      requirements: withoutTolerance,
      quantity: 500,
      deliveryAddress: { line1: 'x', city: 'y', countryCode: 'BD' },
      manufacturerIds: ['mfr_a'],
    });
    expect(result.success).toBe(false);
  });
});

describe('quote submission', () => {
  const validQuote = {
    rfqId: 'rfq_1',
    quantity: 500,
    unitPrice: money(790),
    totalPrice: money(395000),
    shippingEstimate: money(2800),
    leadTimeDays: 24,
    materialProcessNotes: 'FR-4, ENIG',
    terms: 'Funds secured through the platform.',
    expiresAt: '2026-05-31T10:00:00.000Z',
  };

  it('accepts a complete quote', () => {
    const parsed = submitQuoteSchema.parse(validQuote);
    expect(parsed.attachmentIds).toEqual([]);
    expect(parsed.substitutions).toEqual([]);
  });

  it('refuses a quote with no expiry, shipping or terms', () => {
    for (const missing of ['expiresAt', 'shippingEstimate', 'terms'] as const) {
      const candidate: Record<string, unknown> = { ...validQuote };
      delete candidate[missing];
      expect(submitQuoteSchema.safeParse(candidate).success).toBe(false);
    }
  });
});

describe('acceptance and checkout keep the two steps apart', () => {
  it('requires the buyer to acknowledge that funding is still pending', () => {
    expect(acceptQuoteSchema.safeParse({ quoteId: 'quote_1' }).success).toBe(false);
    expect(
      acceptQuoteSchema.safeParse({
        quoteId: 'quote_1',
        acknowledgesPaymentRequired: true,
      }).success,
    ).toBe(true);
  });

  it('requires the buyer to acknowledge that the platform holds the funds', () => {
    const base = {
      quoteId: 'quote_1',
      method: 'card' as const,
      goodsAmount: money(395000),
      shippingAmount: money(2800),
      taxAmount: money(10045),
      platformFee: money(19750),
      totalCharged: money(427595),
    };
    expect(secureCheckoutSchema.safeParse(base).success).toBe(false);
    expect(
      secureCheckoutSchema.safeParse({ ...base, acknowledgesFundsHeldByPlatform: true })
        .success,
    ).toBe(true);
  });
});

describe('production updates', () => {
  it('only accepts canonical stage keys', () => {
    expect(productionStageKeySchema.safeParse('quality_check').success).toBe(true);
    expect(productionStageKeySchema.safeParse('code_flashing').success).toBe(false);
  });

  it('accepts a stage progress update', () => {
    expect(
      updateStageProgressSchema.safeParse({
        orderId: 'order_1',
        stageKey: 'in_production',
        status: 'in_progress',
      }).success,
    ).toBe(true);
  });
});

describe('issue path requires evidence', () => {
  it('refuses a refund request with no evidence', () => {
    const result = requestRefundSchema.safeParse({
      orderId: 'order_1',
      reason: 'failed_quality_check',
      requestedAmount: money(5000),
      description: 'Twelve boards failed the agreed functional test on arrival.',
      evidenceFileIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a refund request with evidence and a manufacturing reason', () => {
    const result = requestRefundSchema.safeParse({
      orderId: 'order_1',
      reason: 'wrong_specification',
      requestedAmount: money(5000),
      description: 'Boards arrived with HASL finish instead of the agreed ENIG finish.',
      evidenceFileIds: ['file_photo_1', 'file_report_1'],
    });
    expect(result.success).toBe(true);
  });

  it('refuses a service-marketplace reason that is not part of the model', () => {
    const result = requestRefundSchema.safeParse({
      orderId: 'order_1',
      reason: 'communication_issues',
      requestedAmount: money(5000),
      description: 'The manufacturer stopped replying to messages for two weeks.',
      evidenceFileIds: ['file_1'],
    });
    expect(result.success).toBe(false);
  });

  it('refuses a dispute with no evidence', () => {
    expect(
      openDisputeSchema.safeParse({
        orderId: 'order_1',
        reason: 'defective_units',
        claimedAmount: money(5000),
        statement: 'The delivered units do not match the accepted specification.',
        evidenceFileIds: [],
      }).success,
    ).toBe(false);
  });
});
