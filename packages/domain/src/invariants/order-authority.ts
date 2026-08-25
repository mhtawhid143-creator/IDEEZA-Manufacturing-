import { PermissionDeniedError } from '../errors.js';
import type { OrderStatus } from '../status/index.js';
import type { Actor } from '../permissions/authorize.js';

/** Terminating an order is an operations decision, never a supplier decision. */
const ORDER_TERMINATION_STATUSES: readonly OrderStatus[] = [
  'cancelled',
  'refunded',
  'partially_refunded',
  'resolved',
];

/**
 * Once an order exists the manufacturer cannot reject or cancel it.
 *
 * The sanctioned route is a cancellation request or a dispute, both of which
 * leave a record and are decided by IDEEZA.
 */
export const assertManufacturerMayNotTerminateOrder = (
  actor: Actor,
  targetStatus: OrderStatus,
): void => {
  if (actor.role !== 'manufacturer') return;
  if (ORDER_TERMINATION_STATUSES.includes(targetStatus)) {
    throw new PermissionDeniedError(
      'cancellation.decide',
      actor.role,
      `a manufacturer may not move an order to "${targetStatus}"; raise a cancellation request or a dispute instead`,
    );
  }
};

/** The only order status a manufacturer may push towards on its own. */
export const MANUFACTURER_CANCELLATION_PATH: OrderStatus = 'cancel_requested';
