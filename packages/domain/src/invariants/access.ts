import { PermissionDeniedError } from '../errors.js';
import type { ManufacturerId, RfqId, UserId } from '../ids.js';
import type { Rfq, RfqRecipient } from '../entities/rfq.js';
import type { Quote } from '../entities/quote.js';
import type { Actor } from '../permissions/authorize.js';

/**
 * A manufacturer may read a request only through its own routing record.
 *
 * Without this, one manufacturer could read another manufacturer's request or
 * pricing, which would destroy the fairness of the comparison the buyer makes.
 *
 * Only the routing pair decides access, so any row carrying that pair may be
 * handed in — a full entity or the two columns a panel selected.
 */
export const assertManufacturerMayReadRfq = <
  Recipient extends Pick<RfqRecipient, 'rfqId' | 'manufacturerId'>,
>(input: {
  readonly recipients: readonly Recipient[];
  readonly manufacturerId: ManufacturerId;
  readonly rfqId: RfqId;
}): Recipient => {
  const recipient = input.recipients.find(
    (candidate) =>
      candidate.rfqId === input.rfqId &&
      candidate.manufacturerId === input.manufacturerId,
  );
  if (recipient === undefined) {
    throw new PermissionDeniedError(
      'rfq.view',
      'manufacturer',
      'this request was not routed to this manufacturer',
    );
  }
  return recipient;
};

export const assertManufacturerMayReadQuote = (
  quote: Pick<Quote, 'id' | 'manufacturerId'>,
  manufacturerId: ManufacturerId,
): void => {
  if (quote.manufacturerId !== manufacturerId) {
    throw new PermissionDeniedError(
      'quote.view',
      'manufacturer',
      'a manufacturer may only read its own quotes',
    );
  }
};

export const assertBuyerOwnsRfq = (
  rfq: Pick<Rfq, 'id' | 'buyerId'>,
  buyerId: UserId,
): void => {
  if (rfq.buyerId !== buyerId) {
    throw new PermissionDeniedError('rfq.view', 'buyer', 'the buyer does not own this request');
  }
};

/**
 * What each side is allowed to see of the responses to one request: the buyer
 * compares them all, a manufacturer sees only its own, operations sees all.
 */
export const visibleQuotesFor = (
  actor: Actor,
  quotesOnRfq: readonly Quote[],
): readonly Quote[] => {
  switch (actor.role) {
    case 'buyer':
    case 'ops_admin':
      return quotesOnRfq;
    case 'manufacturer':
      return quotesOnRfq.filter(
        (quote) => quote.manufacturerId === actor.manufacturerId,
      );
    default:
      return [];
  }
};
