'use server';

import { revalidatePath } from 'next/cache';
import {
  InvariantViolationError,
  assertNoOpenRequestForProduct,
  assertProductManufacturable,
  asId,
  type ProductId,
} from '@ideeza/domain';
import { openRequestForProduct } from '@/data/products.js';
import { draftHrefForProduct, openRequestHref } from '@/lib/routes.js';
import { requireBuyer } from '@/lib/auth.js';
import { database } from '@/lib/db.js';

export interface FavoriteResult {
  readonly favorite: boolean;
}

/**
 * Keep or drop a product.
 *
 * The favourite belongs to the buyer, so the row is written for the signed-in
 * actor and never for an id supplied by the page.
 */
export const toggleFavoriteAction = async (
  productIdInput: string,
): Promise<FavoriteResult> => {
  const actor = await requireBuyer('/favorites');
  const productId = asId<ProductId>(productIdInput);

  const product = await database().product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (product === null) throw new Error('That product does not exist.');

  const existing = await database().productFavorite.findUnique({
    where: { userId_productId: { userId: actor.userId, productId } },
    select: { userId: true },
  });

  if (existing === null) {
    await database().productFavorite.create({
      data: { userId: actor.userId, productId },
    });
  } else {
    await database().productFavorite.delete({
      where: { userId_productId: { userId: actor.userId, productId } },
    });
  }

  revalidatePath('/favorites');
  revalidatePath(`/products/${productIdInput}`);
  return { favorite: existing === null };
};

export type StartManufacturingResult =
  | { readonly kind: 'ready'; readonly href: string; readonly productName: string }
  | {
      readonly kind: 'existing-request';
      readonly rfqId: string;
      readonly status: string;
      readonly href: string;
      readonly productName: string;
    }
  | { readonly kind: 'unavailable'; readonly productName: string };

/**
 * The decision behind "Start manufacturing", taken on the server.
 *
 * Three outcomes, all of them from the domain rules rather than from the
 * screen: the product is not available, the buyer already has an open request
 * for it, or a new draft may be opened.
 */
export const startManufacturingAction = async (
  productIdInput: string,
): Promise<StartManufacturingResult> => {
  const actor = await requireBuyer('/manufacturing/draft/new');
  const productId = asId<ProductId>(productIdInput);

  const product = await database().product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, availability: true },
  });
  if (product === null) throw new Error('That product does not exist.');

  try {
    assertProductManufacturable({ id: productId, availability: product.availability });
  } catch (error) {
    if (error instanceof InvariantViolationError) {
      return { kind: 'unavailable', productName: product.name };
    }
    throw error;
  }

  const open = await openRequestForProduct(actor.userId, productId);
  try {
    assertNoOpenRequestForProduct(productId, open);
  } catch (error) {
    if (error instanceof InvariantViolationError && open !== undefined) {
      return {
        kind: 'existing-request',
        rfqId: open.rfqId,
        status: open.status,
        href: openRequestHref(open.rfqId, open.status),
        productName: product.name,
      };
    }
    throw error;
  }

  return {
    kind: 'ready',
    href: draftHrefForProduct(productIdInput),
    productName: product.name,
  };
};
