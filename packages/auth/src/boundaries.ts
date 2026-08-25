import {
  PermissionDeniedError,
  asId,
  assertBuyerOwnsRfq,
  assertCan,
  assertManufacturerMayReadQuote,
  assertManufacturerMayReadRfq,
  type ManufacturerId,
  type RfqId,
  type UserId,
} from '@ideeza/domain';
import type { AuthenticatedActor } from './actor.js';
import type { BoundaryStore } from './ports.js';

/**
 * Resource level access checks.
 *
 * The rules themselves live in the domain layer; this module supplies them with
 * the rows they need and turns a missing record into the same refusal as an
 * unauthorised one, so probing for ids tells an attacker nothing.
 */

export class ResourceNotVisibleError extends PermissionDeniedError {
  public constructor(kind: string, id: string, role: string) {
    super(`${kind}.view`, role, `${kind} ${id} is not visible to this actor`);
  }
}

const requireManufacturerBinding = (actor: AuthenticatedActor): ManufacturerId => {
  if (actor.manufacturerId === undefined) {
    throw new PermissionDeniedError(
      'manufacturer.binding',
      actor.role,
      'the session does not act for a manufacturer',
    );
  }
  return actor.manufacturerId;
};

export interface RfqAccess {
  readonly rfqId: RfqId;
  readonly buyerId: UserId;
}

/** A buyer reaches its own request; a manufacturer only through its routing record. */
export const authorizeRfqAccess = async (
  actor: AuthenticatedActor,
  store: BoundaryStore,
  rfqId: string,
): Promise<RfqAccess> => {
  assertCan(actor, 'rfq.view');
  const rfq = await store.findRfqOwnership(rfqId);
  if (rfq === null) throw new ResourceNotVisibleError('rfq', rfqId, actor.role);

  const access: RfqAccess = {
    rfqId: asId<RfqId>(rfq.id),
    buyerId: asId<UserId>(rfq.buyerId),
  };

  switch (actor.role) {
    case 'buyer':
      assertBuyerOwnsRfq({ id: access.rfqId, buyerId: access.buyerId }, actor.userId);
      return access;
    case 'manufacturer': {
      const manufacturerId = requireManufacturerBinding(actor);
      const recipients = await store.listRfqRecipients(rfq.id);
      assertManufacturerMayReadRfq({
        recipients: recipients.map((recipient) => ({
          id: asId('recipient'),
          rfqId: asId<RfqId>(recipient.rfqId),
          manufacturerId: asId<ManufacturerId>(recipient.manufacturerId),
          status: 'routed' as const,
        })),
        manufacturerId,
        rfqId: access.rfqId,
      });
      return access;
    }
    case 'ops_admin':
      return access;
    default:
      throw new ResourceNotVisibleError('rfq', rfqId, actor.role);
  }
};

export interface QuoteAccess {
  readonly id: string;
  readonly rfqId: string;
  readonly manufacturerId: string;
}

/**
 * The buyer sees every quote on its own request, a manufacturer sees only its
 * own, operations sees all. This is what keeps competing prices apart.
 */
export const authorizeQuoteAccess = async (
  actor: AuthenticatedActor,
  store: BoundaryStore,
  quoteId: string,
): Promise<QuoteAccess> => {
  assertCan(actor, 'quote.view');
  const quote = await store.findQuoteOwnership(quoteId);
  if (quote === null) throw new ResourceNotVisibleError('quote', quoteId, actor.role);

  if (actor.role === 'manufacturer') {
    const manufacturerId = requireManufacturerBinding(actor);
    assertManufacturerMayReadQuote(
      {
        id: asId(quote.id),
        manufacturerId: asId<ManufacturerId>(quote.manufacturerId),
      },
      manufacturerId,
    );
    return quote;
  }

  if (actor.role === 'buyer') {
    await authorizeRfqAccess(actor, store, quote.rfqId);
    return quote;
  }

  return quote;
};

/** The quotes on one request that this actor may compare. */
export const listVisibleQuotes = async (
  actor: AuthenticatedActor,
  store: BoundaryStore,
  rfqId: string,
): Promise<readonly QuoteAccess[]> => {
  await authorizeRfqAccess(actor, store, rfqId);
  const quotes = await store.listQuotesForRfq(rfqId);
  if (actor.role !== 'manufacturer') return quotes;
  const manufacturerId = requireManufacturerBinding(actor);
  return quotes.filter((quote) => quote.manufacturerId === manufacturerId);
};

export interface OrderAccess {
  readonly id: string;
  readonly buyerId: string;
  readonly manufacturerId: string;
}

/** Both counterparties of an order may read it; nobody else may. */
export const authorizeOrderAccess = async (
  actor: AuthenticatedActor,
  store: BoundaryStore,
  orderId: string,
): Promise<OrderAccess> => {
  assertCan(actor, 'order.view');
  const order = await store.findOrderOwnership(orderId);
  if (order === null) throw new ResourceNotVisibleError('order', orderId, actor.role);

  switch (actor.role) {
    case 'buyer':
      if (order.buyerId !== actor.userId) {
        throw new ResourceNotVisibleError('order', orderId, actor.role);
      }
      return order;
    case 'manufacturer': {
      const manufacturerId = requireManufacturerBinding(actor);
      if (order.manufacturerId !== manufacturerId) {
        throw new ResourceNotVisibleError('order', orderId, actor.role);
      }
      return order;
    }
    case 'ops_admin':
      return order;
    default:
      throw new ResourceNotVisibleError('order', orderId, actor.role);
  }
};

/** Stock is manufacturer property: a buyer has no capability for it at all. */
export const authorizeInventoryAccess = async (
  actor: AuthenticatedActor,
  store: BoundaryStore,
  itemId: string,
  intent: 'read' | 'write' = 'read',
): Promise<{ readonly id: string; readonly manufacturerId: string }> => {
  assertCan(actor, intent === 'read' ? 'inventory.read' : 'inventory.write');
  const item = await store.findInventoryOwnership(itemId);
  if (item === null) throw new ResourceNotVisibleError('inventory', itemId, actor.role);

  if (actor.role === 'manufacturer') {
    const manufacturerId = requireManufacturerBinding(actor);
    if (item.manufacturerId !== manufacturerId) {
      throw new ResourceNotVisibleError('inventory', itemId, actor.role);
    }
  }
  return item;
};

/** A manufacturer may look at its own payouts; releasing one is operations only. */
export const authorizePayoutAccess = async (
  actor: AuthenticatedActor,
  store: BoundaryStore,
  payoutId: string,
  intent: 'read' | 'release' = 'read',
): Promise<{ readonly id: string; readonly manufacturerId: string }> => {
  if (intent === 'release') {
    assertCan(actor, 'payout.release');
  } else if (actor.role === 'manufacturer') {
    assertCan(actor, 'payout.withdraw');
  } else if (actor.role !== 'ops_admin') {
    throw new PermissionDeniedError('payout.read', actor.role);
  }

  const payout = await store.findPayoutOwnership(payoutId);
  if (payout === null) throw new ResourceNotVisibleError('payout', payoutId, actor.role);

  if (actor.role === 'manufacturer') {
    const manufacturerId = requireManufacturerBinding(actor);
    if (payout.manufacturerId !== manufacturerId) {
      throw new ResourceNotVisibleError('payout', payoutId, actor.role);
    }
  }
  return payout;
};
