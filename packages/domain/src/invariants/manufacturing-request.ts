import { InvariantViolationError } from '../errors.js';
import type { ProductId, RfqId } from '../ids.js';
import type { ProductAvailability, RfqStatus } from '../status/index.js';

/**
 * A request is open while the buyer can still act on it: a draft is still being
 * prepared, and a submitted request is still collecting quotes. A closed or
 * withdrawn request is finished and no longer blocks anything.
 */
export const OPEN_RFQ_STATUSES: readonly RfqStatus[] = Object.freeze(['draft', 'submitted']);

export const isOpenRequestStatus = (status: RfqStatus): boolean =>
  OPEN_RFQ_STATUSES.includes(status);

/** The open request that already covers a product, if there is one. */
export interface OpenProductRequest {
  readonly rfqId: RfqId;
  readonly status: RfqStatus;
}

/**
 * Only an available product may start a manufacturing request.
 *
 * The check lives here rather than in the screen so that the button state and
 * the action that the button triggers can never disagree.
 */
export const assertProductManufacturable = (product: {
  readonly id: ProductId;
  readonly availability: ProductAvailability;
}): void => {
  if (product.availability !== 'available') {
    throw new InvariantViolationError(
      'ProductManufacturable',
      `product ${product.id} is not available for manufacturing`,
    );
  }
};

/**
 * One open request per product per buyer.
 *
 * Two open requests for the same product would collect two sets of quotes for
 * the same thing, and accepting one quote from each would create two orders
 * that the buyer never meant to place. The buyer is sent to the request that
 * already exists instead.
 */
export const assertNoOpenRequestForProduct = (
  productId: ProductId,
  existing: OpenProductRequest | undefined,
): void => {
  if (existing !== undefined && isOpenRequestStatus(existing.status)) {
    throw new InvariantViolationError(
      'OneOpenRequestPerProduct',
      `product ${productId} already has an open request (${existing.rfqId}, ${existing.status})`,
    );
  }
};
