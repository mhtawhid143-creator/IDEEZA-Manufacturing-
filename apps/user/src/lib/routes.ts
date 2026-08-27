/**
 * Route helpers shared by the server actions and the screens.
 *
 * These live outside the action modules because a file marked 'use server'
 * may only export async server actions.
 */

/** Where the buyer lands once a manufacturing draft may be started. */
export const draftHrefForProduct = (productId: string): string =>
  `/manufacturing/draft/new?product=${encodeURIComponent(productId)}`;

/** The request a buyer already has open, wherever it currently lives. */
export const openRequestHref = (rfqId: string, status: string): string =>
  status === 'draft' ? `/manufacturing/draft/${rfqId}` : `/manufacturing/rfq/${rfqId}`;
