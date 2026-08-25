import { describe, expect, it } from 'vitest';
import {
  PermissionDeniedError,
  assertBuyerOwnsRfq,
  assertManufacturerMayReadQuote,
  assertManufacturerMayReadRfq,
  asId,
  visibleQuotesFor,
  type UserId,
} from '@ideeza/domain';
import {
  buildQuote,
  buildRecipient,
  buildRfq,
  buyerId,
  manufacturerA,
  manufacturerB,
  rfqId,
} from './fixtures.js';

const recipients = [buildRecipient(manufacturerA)];

describe('a manufacturer only reaches its own routing record', () => {
  it('allows the manufacturer the request was routed to', () => {
    const recipient = assertManufacturerMayReadRfq({
      recipients,
      manufacturerId: manufacturerA,
      rfqId,
    });
    expect(recipient.manufacturerId).toBe(manufacturerA);
  });

  it('refuses a manufacturer the request was not routed to', () => {
    expect(() =>
      assertManufacturerMayReadRfq({
        recipients,
        manufacturerId: manufacturerB,
        rfqId,
      }),
    ).toThrow(PermissionDeniedError);
  });
});

describe('a manufacturer only reads its own quotes', () => {
  const quoteFromA = buildQuote({ manufacturerId: manufacturerA });

  it('allows the author', () => {
    expect(() => assertManufacturerMayReadQuote(quoteFromA, manufacturerA)).not.toThrow();
  });

  it('refuses a competitor', () => {
    expect(() => assertManufacturerMayReadQuote(quoteFromA, manufacturerB)).toThrow(
      PermissionDeniedError,
    );
  });

  it('filters the comparison set per role', () => {
    const quotes = [
      buildQuote({ manufacturerId: manufacturerA }),
      buildQuote({ manufacturerId: manufacturerB }),
    ];

    expect(visibleQuotesFor({ role: 'buyer', userId: buyerId }, quotes)).toHaveLength(2);
    expect(visibleQuotesFor({ role: 'ops_admin' }, quotes)).toHaveLength(2);

    const manufacturerView = visibleQuotesFor(
      { role: 'manufacturer', manufacturerId: manufacturerB },
      quotes,
    );
    expect(manufacturerView).toHaveLength(1);
    expect(manufacturerView[0]?.manufacturerId).toBe(manufacturerB);
  });
});

describe('buyer ownership', () => {
  it('refuses another buyer', () => {
    expect(() =>
      assertBuyerOwnsRfq(buildRfq(), asId<UserId>('user_someone_else')),
    ).toThrow(PermissionDeniedError);
  });

  it('allows the owner', () => {
    expect(() => assertBuyerOwnsRfq(buildRfq(), buyerId)).not.toThrow();
  });
});
