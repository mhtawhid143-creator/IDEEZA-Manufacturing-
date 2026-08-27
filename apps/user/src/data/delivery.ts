import {
  applyTransition,
  assertDeliveryConfirmable,
  assertReviewPublishable,
  asId,
  averageRating,
  isReviewWindowOpen,
  orderMachine,
  paymentMachine,
  payoutMachine,
  reviewWindowDaysLeft,
  reviewWindowEnd,
  type OrderId,
  type OrderStatus,
  type UserId,
} from '@ideeza/domain';
import { toDatabaseEventKind } from '@ideeza/db';
import type { PublishReviewInput } from '@ideeza/types';
import { database } from '@/lib/db.js';

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * How long the buyer has to inspect what arrived before the money goes.
 *
 * The business model names the window and what its expiry does, but not its
 * length: that is an open product decision. It is a platform parameter here,
 * stated on screen wherever it applies, so nothing pretends this number came
 * from the agreed terms.
 */
export const REVIEW_WINDOW_DAYS = 7;

export interface DeliveryView {
  readonly orderId: OrderId;
  readonly status: OrderStatus;
  readonly productName: string;
  readonly manufacturerId: string;
  readonly manufacturerName: string;
  readonly quantity: number;
  readonly currency: string;
  readonly heldMinor: number;
  readonly deliveredAt: Date | null;
  readonly completedAt: Date | null;
  readonly reviewWindowEndsAt: Date | null;
  readonly reviewWindowOpen: boolean;
  readonly reviewWindowDaysLeft: number;
  readonly canConfirmDelivery: boolean;
  readonly confirmBlockedReason: string | null;
  readonly paymentStatus: string | null;
  readonly payoutStatus: string | null;
  readonly review: {
    readonly rating: number;
    readonly body: string | null;
    readonly anonymous: boolean;
    readonly createdAt: Date;
  } | null;
  readonly canReview: boolean;
  readonly reviewBlockedReason: string | null;
  readonly deliveryRecords: readonly {
    readonly id: string;
    readonly kind: string;
    readonly title: string;
    readonly capturedAt: Date;
  }[];
}

const deliveryInclude = {
  manufacturer: { select: { id: true, displayName: true } },
  snapshot: true,
  payment: true,
  review: true,
  payouts: true,
  rfq: { select: { package: { select: { product: { select: { name: true } } } } } },
} as const;

/** Why the buyer cannot confirm, said in the words of the rule that stops it. */
const reasonFor = (run: () => void): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'not available';
  }
};

export const getDelivery = async (
  buyerId: UserId,
  orderId: OrderId,
  now: Date = new Date(),
): Promise<DeliveryView | null> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, buyerId },
    include: deliveryInclude,
  });
  if (order === null || order.snapshot === null) return null;

  const records = await database().evidence.findMany({
    where: {
      orderId: order.id,
      kind: { in: ['shipping_record', 'delivery_record', 'buyer_statement'] },
    },
    orderBy: { capturedAt: 'desc' },
  });

  const confirmBlockedReason = reasonFor(() =>
    assertDeliveryConfirmable(order.id, order.status, order.deliveredAt),
  );
  const reviewBlockedReason = reasonFor(() =>
    assertReviewPublishable({
      orderStatus: order.status,
      deliveredAt: order.deliveredAt,
      alreadyReviewed: order.review !== null,
      rating: 5,
    }),
  );

  return {
    orderId: asId<OrderId>(order.id),
    status: order.status,
    productName: order.rfq.package.product.name,
    manufacturerId: order.manufacturer.id,
    manufacturerName: order.manufacturer.displayName,
    quantity: order.snapshot.quantity,
    currency: order.snapshot.currency,
    heldMinor: order.payment === null ? 0 : Number(order.payment.totalChargedMinor),
    deliveredAt: order.deliveredAt,
    completedAt: order.completedAt,
    reviewWindowEndsAt: order.reviewWindowEndsAt,
    reviewWindowOpen: isReviewWindowOpen(order.reviewWindowEndsAt, now),
    reviewWindowDaysLeft: reviewWindowDaysLeft(order.reviewWindowEndsAt, now),
    canConfirmDelivery: confirmBlockedReason === null,
    confirmBlockedReason,
    paymentStatus: order.payment?.status ?? null,
    payoutStatus: order.payouts[0]?.status ?? null,
    review:
      order.review === null
        ? null
        : {
            rating: order.review.rating,
            body: order.review.body,
            anonymous: order.review.anonymous,
            createdAt: order.review.createdAt,
          },
    canReview: reviewBlockedReason === null,
    reviewBlockedReason,
    deliveryRecords: records.map((record) => ({
      id: record.id,
      kind: record.kind,
      title: record.title,
      capturedAt: record.capturedAt,
    })),
  };
};

export interface ConfirmDeliveryResult {
  readonly orderId: OrderId;
  readonly status: OrderStatus;
  readonly payoutReleased: boolean;
}

/**
 * The buyer confirms that what arrived is what was ordered.
 *
 * This is the documented event the money is released against, so all of it
 * happens together or not at all: the event is recorded, the order completes,
 * the payment moves out of escrow, the payout is released against that event id,
 * and the confirmation itself is kept as evidence.
 */
export const confirmDelivery = async (
  buyerId: UserId,
  orderId: OrderId,
  note: string | undefined,
  now: Date = new Date(),
): Promise<ConfirmDeliveryResult> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, buyerId },
    include: { payment: true, payouts: true, disputes: true, refunds: true },
  });
  if (order === null) throw new Error('That order does not exist.');

  assertDeliveryConfirmable(order.id, order.status, order.deliveredAt);

  const hasOpenIssue =
    order.disputes.some((dispute) => dispute.status !== 'resolved') ||
    order.refunds.some((refund) => refund.status === 'requested');

  const completedStatus = applyTransition(orderMachine, order.status, 'completed', {
    paymentStatus: order.payment?.status,
    actorRole: 'buyer',
    recordedEventKinds: ['order.delivery_confirmed'],
  });

  const eventId = identifier('evt');
  let payoutReleased = false;

  await database().$transaction(async (transaction) => {
    await transaction.domainEvent.create({
      data: {
        id: eventId,
        kind: toDatabaseEventKind('order.delivery_confirmed'),
        actorRole: 'buyer',
        actorUserId: buyerId,
        subjectKind: 'order',
        subjectId: order.id,
        orderId: order.id,
        payload: { note: note ?? null },
        occurredAt: now,
      },
    });

    await transaction.manufacturingOrder.update({
      where: { id: order.id },
      data: { status: completedStatus, completedAt: now },
    });

    if (order.payment !== null && order.payment.status === 'secured') {
      await transaction.payment.update({
        where: { id: order.payment.id },
        data: {
          status: applyTransition(paymentMachine, order.payment.status, 'released', undefined),
          releasedAt: now,
        },
      });
    }

    // The payout moves only against the event that was just recorded, and only
    // when nothing is being contested.
    const payout = order.payouts[0];
    if (payout !== undefined && payout.status === 'pending_release' && !hasOpenIssue) {
      await transaction.payout.update({
        where: { id: payout.id },
        data: {
          status: applyTransition(payoutMachine, payout.status, 'released', {
            releaseTriggerEventKind: 'order.delivery_confirmed',
            releaseTriggerEventId: eventId,
            hasOpenDispute: false,
          }),
          releaseTriggerEventId: eventId,
          releasedAt: now,
        },
      });
      payoutReleased = true;
    }

    await transaction.evidence.create({
      data: {
        id: identifier('ev'),
        contextKind: 'delivery',
        kind: 'delivery_record',
        title: 'Delivery confirmed by the buyer',
        orderId: order.id,
        submittedById: buyerId,
        payload: { note: note ?? null, releasedPayout: payoutReleased },
        capturedAt: now,
      },
    });

    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('order.completed'),
        actorRole: 'buyer',
        actorUserId: buyerId,
        subjectKind: 'order',
        subjectId: order.id,
        orderId: order.id,
        payload: { payoutReleased },
        occurredAt: now,
      },
    });
  });

  return { orderId: asId<OrderId>(order.id), status: completedStatus, payoutReleased };
};

/**
 * Records the delivery the manufacturer reports.
 *
 * The manufacturer panel owns this action; it lives here so the buyer app can be
 * exercised against a real delivered order, and so the review window is opened
 * by the same rule in both panels.
 */
export const recordDelivery = async (
  orderId: OrderId,
  now: Date = new Date(),
): Promise<Date> => {
  const endsAt = reviewWindowEnd(now, REVIEW_WINDOW_DAYS);
  await database().manufacturingOrder.update({
    where: { id: orderId },
    data: { deliveredAt: now, reviewWindowEndsAt: endsAt },
  });
  return endsAt;
};

export interface PublishReviewResult {
  readonly reviewId: string;
  readonly manufacturerRating: number | null;
}

/**
 * The buyer's public review of the manufacturer.
 *
 * It is bound to one delivered order, which is what stops a rating from being
 * left by someone who never bought anything. Publishing recomputes the
 * manufacturer's public rating from every review it has, so the number on a
 * manufacturer card is always the average of real orders.
 */
export const publishReview = async (
  buyerId: UserId,
  input: PublishReviewInput,
  now: Date = new Date(),
): Promise<PublishReviewResult> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: input.orderId, buyerId },
    include: { review: true },
  });
  if (order === null) throw new Error('That order does not exist.');

  assertReviewPublishable({
    orderStatus: order.status,
    deliveredAt: order.deliveredAt,
    alreadyReviewed: order.review !== null,
    rating: input.rating,
  });

  const reviewId = identifier('rev');

  const rating = await database().$transaction(async (transaction) => {
    await transaction.review.create({
      data: {
        id: reviewId,
        orderId: order.id,
        manufacturerId: order.manufacturerId,
        authorId: buyerId,
        rating: input.rating,
        body: input.body ?? null,
        anonymous: input.anonymous,
        createdAt: now,
      },
    });

    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('review.published'),
        actorRole: 'buyer',
        actorUserId: buyerId,
        subjectKind: 'review',
        subjectId: reviewId,
        orderId: order.id,
        payload: { rating: input.rating, anonymous: input.anonymous },
        occurredAt: now,
      },
    });

    const reviews = await transaction.review.findMany({
      where: { manufacturerId: order.manufacturerId },
      select: { rating: true },
    });
    const average = averageRating(reviews.map((review) => review.rating));
    await transaction.manufacturerProfile.update({
      where: { id: order.manufacturerId },
      data: { rating: average },
    });
    return average;
  });

  return { reviewId, manufacturerRating: rating };
};

export interface HistoryRow {
  readonly orderId: OrderId;
  readonly rfqId: string;
  readonly productId: string;
  readonly productName: string;
  readonly manufacturerName: string;
  readonly status: OrderStatus;
  readonly outcome: string;
  readonly currency: string;
  readonly totalMinor: number;
  readonly quantity: number;
  readonly fileCount: number;
  readonly packageKind: string;
  readonly requestedServices: readonly string[];
  readonly closedAt: Date;
  readonly reviewed: boolean;
  readonly canReview: boolean;
  readonly reviewWindowDaysLeft: number;
}

/**
 * What happened to an order, in one phrase.
 *
 * The design shows every history row as "Delivered". A closed order can have
 * ended in several ways, and which one it was is the single most useful thing
 * about a past order, so the row carries the real outcome.
 */
const OUTCOME: Readonly<Record<string, string>> = {
  delivered: 'Delivered, review window open',
  completed: 'Completed, money released',
  cancelled: 'Cancelled before production',
  refunded: 'Refunded in full',
  partially_refunded: 'Partially refunded',
  resolved: 'Resolved after a dispute',
};

/**
 * Order History: everything that is finished, plus what is delivered and waiting
 * out its review window, because that order is done being made and the buyer's
 * remaining action is a decision about it rather than production.
 */
export const listHistory = async (
  buyerId: UserId,
  now: Date = new Date(),
): Promise<readonly HistoryRow[]> => {
  const rows = await database().manufacturingOrder.findMany({
    where: {
      buyerId,
      status: {
        in: ['delivered', 'completed', 'cancelled', 'refunded', 'partially_refunded', 'resolved'],
      },
    },
    include: {
      manufacturer: { select: { displayName: true } },
      snapshot: true,
      review: { select: { id: true } },
      rfq: {
        select: {
          id: true,
          requestedServices: true,
          package: {
            select: {
              kind: true,
              product: { select: { id: true, name: true } },
              _count: { select: { files: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((row) => ({
    orderId: asId<OrderId>(row.id),
    rfqId: row.rfqId,
    productId: row.rfq.package.product.id,
    productName: row.rfq.package.product.name,
    manufacturerName: row.manufacturer.displayName,
    status: row.status,
    outcome: OUTCOME[row.status] ?? row.status.replace(/_/g, ' '),
    currency: row.snapshot?.currency ?? 'USD',
    totalMinor: Number(row.snapshot?.totalPriceMinor ?? 0n),
    quantity: row.snapshot?.quantity ?? 0,
    fileCount: row.rfq.package._count.files,
    packageKind: row.rfq.package.kind,
    requestedServices: row.rfq.requestedServices,
    closedAt: row.completedAt ?? row.deliveredAt ?? row.createdAt,
    reviewed: row.review !== null,
    canReview: row.review === null && row.deliveredAt !== null,
    reviewWindowDaysLeft: reviewWindowDaysLeft(row.reviewWindowEndsAt, now),
  }));
};
