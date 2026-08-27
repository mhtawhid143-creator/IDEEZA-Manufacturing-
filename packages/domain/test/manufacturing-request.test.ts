import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  OPEN_RFQ_STATUSES,
  asId,
  assertNoOpenRequestForProduct,
  assertProductManufacturable,
  isOpenRequestStatus,
  type ProductId,
  type RfqId,
} from '../src/index.js';

const product = asId<ProductId>('product_1');
const rfq = asId<RfqId>('rfq_1');

describe('starting a manufacturing request', () => {
  it('treats a draft and a submitted request as open, and nothing else', () => {
    expect([...OPEN_RFQ_STATUSES]).toEqual(['draft', 'submitted']);
    expect(isOpenRequestStatus('draft')).toBe(true);
    expect(isOpenRequestStatus('submitted')).toBe(true);
    expect(isOpenRequestStatus('closed')).toBe(false);
    expect(isOpenRequestStatus('withdrawn')).toBe(false);
  });

  it('lets an available product start a request', () => {
    expect(() =>
      assertProductManufacturable({ id: product, availability: 'available' }),
    ).not.toThrow();
  });

  it('refuses a product the creator has withdrawn', () => {
    expect(() =>
      assertProductManufacturable({ id: product, availability: 'unavailable' }),
    ).toThrow(InvariantViolationError);
  });

  it('allows a request when the buyer has none open for the product', () => {
    expect(() => assertNoOpenRequestForProduct(product, undefined)).not.toThrow();
  });

  it('refuses a second request while a draft is open', () => {
    expect(() =>
      assertNoOpenRequestForProduct(product, { rfqId: rfq, status: 'draft' }),
    ).toThrow(InvariantViolationError);
  });

  it('refuses a second request while one is out for quotes', () => {
    expect(() =>
      assertNoOpenRequestForProduct(product, { rfqId: rfq, status: 'submitted' }),
    ).toThrow(/already has an open request/);
  });

  it('allows a new request once the previous one is closed or withdrawn', () => {
    expect(() =>
      assertNoOpenRequestForProduct(product, { rfqId: rfq, status: 'closed' }),
    ).not.toThrow();
    expect(() =>
      assertNoOpenRequestForProduct(product, { rfqId: rfq, status: 'withdrawn' }),
    ).not.toThrow();
  });
});
