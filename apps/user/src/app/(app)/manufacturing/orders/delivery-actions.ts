'use server';

import {
  DomainError,
  InvariantViolationError,
  asId,
  assertNoOpenRequestForProduct,
  assertProductManufacturable,
  type OrderId,
  type ProductId,
} from '@ideeza/domain';
import { publishReviewSchema } from '@ideeza/types';
import { confirmDelivery, publishReview } from '@/data/delivery.js';
import { createDraftFromOrder } from '@/data/drafts.js';
import { openRequestForProduct } from '@/data/products.js';
import { database } from '@/lib/db.js';
import { requireBuyer } from '@/lib/auth.js';

export interface ConfirmDeliveryState {
  readonly error?: string;
  readonly redirectTo?: string;
  readonly payoutReleased?: boolean;
}

/**
 * Confirms delivery, which is the event the money is released against.
 *
 * The screen has already said what that means; this only checks that the buyer
 * owns the order and lets the domain decide the rest.
 */
export const confirmDeliveryAction = async (
  orderIdInput: string,
  note: string,
): Promise<ConfirmDeliveryState> => {
  const actor = await requireBuyer(`/manufacturing/orders/${orderIdInput}/confirm-delivery`);
  try {
    const result = await confirmDelivery(
      actor.userId,
      asId<OrderId>(orderIdInput),
      note.trim() === '' ? undefined : note.trim(),
    );
    return {
      redirectTo: `/manufacturing/orders/${orderIdInput}?confirmed=1`,
      payoutReleased: result.payoutReleased,
    };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    return { error: 'The confirmation could not be recorded.' };
  }
};

export interface ReviewState {
  readonly error?: string;
  readonly rating?: number;
  readonly manufacturerRating?: number | null;
}

/** Publishes the buyer's review of the manufacturer for one delivered order. */
export const publishReviewAction = async (input: {
  readonly orderId: string;
  readonly rating: number;
  readonly body?: string;
  readonly anonymous?: boolean;
}): Promise<ReviewState> => {
  const actor = await requireBuyer(`/manufacturing/orders/${input.orderId}`);

  const parsed = publishReviewSchema.safeParse({
    orderId: input.orderId,
    rating: input.rating,
    ...(input.body === undefined || input.body.trim() === ''
      ? {}
      : { body: input.body.trim() }),
    anonymous: input.anonymous ?? false,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That review is not valid.' };
  }

  try {
    const result = await publishReview(actor.userId, parsed.data);
    return { rating: parsed.data.rating, manufacturerRating: result.manufacturerRating };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    return { error: 'That review could not be published.' };
  }
};

export type ReorderState =
  | { readonly kind: 'ready'; readonly href: string }
  | { readonly kind: 'existing-request'; readonly rfqId: string; readonly href: string }
  | { readonly kind: 'unavailable'; readonly productName: string }
  | { readonly kind: 'error'; readonly message: string };

/**
 * Orders the same thing again.
 *
 * It is the same decision "Start manufacturing" makes, because it is the same
 * act: the product must still be available, and a buyer may only have one open
 * request per product. When both hold, the previous request is copied into a
 * fresh draft so nothing has to be typed twice.
 */
export const reorderAction = async (orderIdInput: string): Promise<ReorderState> => {
  const actor = await requireBuyer('/manufacturing/draft/new');

  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderIdInput, buyerId: actor.userId },
    select: {
      rfq: {
        select: { package: { select: { product: { select: { id: true, name: true, availability: true } } } } },
      },
    },
  });
  if (order === null) return { kind: 'error', message: 'That order does not exist.' };

  const product = order.rfq.package.product;
  const productId = asId<ProductId>(product.id);

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
        href: `/manufacturing/rfq/${open.rfqId}`,
      };
    }
    throw error;
  }

  try {
    const draft = await createDraftFromOrder(actor.userId, orderIdInput);
    return { kind: 'ready', href: `/manufacturing/draft/${draft.rfqId}?reordered=1` };
  } catch (error) {
    if (error instanceof DomainError) return { kind: 'error', message: error.message };
    if (error instanceof Error) return { kind: 'error', message: error.message };
    return { kind: 'error', message: 'That draft could not be opened.' };
  }
};
