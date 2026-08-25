/**
 * Manufacturing order lifecycle.
 *
 * awaiting_payment exists because accepting a quote does not create a confirmed
 * order: funding has to be secured by the platform first.
 */
export const ORDER_STATUSES = [
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
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** The happy-path spine, in order. Exception states are handled separately. */
export const ORDER_HAPPY_PATH = [
  'awaiting_payment',
  'confirmed',
  'in_production',
  'quality_check',
  'ready_to_ship',
  'shipped',
  'delivered',
  'completed',
] as const satisfies readonly OrderStatus[];

/** Statuses in which physical production work is permitted. */
export const PRODUCTION_ACTIVE_STATUSES = [
  'in_production',
  'quality_check',
  'ready_to_ship',
] as const satisfies readonly OrderStatus[];
