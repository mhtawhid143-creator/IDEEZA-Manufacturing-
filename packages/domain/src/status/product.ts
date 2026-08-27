/**
 * Whether a published product may be sent to manufacture.
 *
 * A product that its creator has taken out of circulation still exists, is
 * still favourited and is still readable, but it cannot start a manufacturing
 * request: the request would carry files and a bill of materials that the
 * creator no longer stands behind.
 */
export const PRODUCT_AVAILABILITY = ['available', 'unavailable'] as const;
export type ProductAvailability = (typeof PRODUCT_AVAILABILITY)[number];
