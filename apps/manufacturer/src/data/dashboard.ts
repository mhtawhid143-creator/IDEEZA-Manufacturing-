import {
  OPEN_RFQ_STATUSES,
  TRANSIT_DAYS,
  orderReference,
  quoteReference,
  requestReference,
  type ManufacturerId,
} from '@ideeza/domain';
import { database } from '@/lib/db.js';

export interface HeadlineTiles {
  readonly openRfqs: number;
  readonly newThisWeek: number;
  readonly needResponse: number;
  readonly quotesSubmitted: number;
  readonly quotesAccepted: number;
  readonly delayedOrders: number;
  readonly ordersInFlight: number;
  readonly onTimeDeliveryRate: number | null;
  readonly lowStockItems: number;
  readonly criticalStockItems: number;
  readonly pendingPayoutMinor: number;
  readonly pendingPayoutCount: number;
  readonly currency: string;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * The six numbers across the top of the dashboard.
 *
 * Each one is a question a shop actually asks in the morning: what has come in,
 * what have I answered, what is late, am I keeping my promises, what am I about
 * to run out of, and what am I owed. Every one is a real query against this
 * shop's own rows — there is no derived "score" here that cannot be traced back
 * to a record.
 */
export const getHeadlineTiles = async (
  manufacturerId: ManufacturerId,
  now: Date = new Date(),
): Promise<HeadlineTiles> => {
  const weekAgo = new Date(now.getTime() - 7 * DAY);

  const [
    openRfqs,
    newThisWeek,
    needResponse,
    quotesSubmitted,
    quotesAccepted,
    liveOrders,
    profile,
    inventory,
    payouts,
  ] = await Promise.all([
    database().rfqRecipient.count({
      where: {
        manufacturerId,
        status: { in: ['routed', 'viewed'] },
        rfq: { status: { in: [...OPEN_RFQ_STATUSES] } },
      },
    }),
    database().rfqRecipient.count({
      where: {
        manufacturerId,
        createdAt: { gte: weekAgo },
        rfq: { status: { in: [...OPEN_RFQ_STATUSES] } },
      },
    }),
    // A request with a response deadline that has not been answered yet.
    database().rfqRecipient.count({
      where: {
        manufacturerId,
        status: { in: ['routed', 'viewed'] },
        rfq: { status: { in: [...OPEN_RFQ_STATUSES] }, responseDeadline: { not: null } },
      },
    }),
    // A revised quote is still live and still waiting on the buyer, so it counts
    // as one awaiting a decision rather than disappearing from the tile.
    database().quote.count({
      where: { manufacturerId, status: { in: ['submitted', 'revised'] } },
    }),
    database().quote.count({ where: { manufacturerId, status: 'accepted' } }),
    database().manufacturingOrder.findMany({
      where: {
        manufacturerId,
        status: {
          in: ['confirmed', 'in_production', 'quality_check', 'ready_to_ship', 'shipped'],
        },
      },
      select: {
        id: true,
        status: true,
        confirmedAt: true,
        shippingChoice: true,
        snapshot: { select: { leadTimeDays: true } },
      },
    }),
    database().manufacturerProfile.findUnique({
      where: { id: manufacturerId },
      select: { onTimeDeliveryRate: true },
    }),
    database().inventoryItem.findMany({
      where: { manufacturerId },
      select: { stockQuantity: true, reservedQuantity: true, lowStockThreshold: true },
    }),
    database().payout.findMany({
      where: { manufacturerId, status: 'pending_release' },
      select: { netAmountMinor: true, currency: true },
    }),
  ]);

  // Late means the units have not shipped by the date the accepted lead time
  // promised, counted from the moment the funds were secured.
  const delayedOrders = liveOrders.filter((order) => {
    if (order.confirmedAt === null || order.snapshot === null) return false;
    if (order.status === 'shipped') return false;
    const due =
      order.confirmedAt.getTime() + order.snapshot.leadTimeDays * DAY;
    return due < now.getTime();
  }).length;

  const available = (item: {
    readonly stockQuantity: number;
    readonly reservedQuantity: number;
  }): number => item.stockQuantity - item.reservedQuantity;

  return {
    openRfqs,
    newThisWeek,
    needResponse,
    quotesSubmitted,
    quotesAccepted,
    delayedOrders,
    ordersInFlight: liveOrders.length,
    onTimeDeliveryRate:
      profile?.onTimeDeliveryRate === null || profile?.onTimeDeliveryRate === undefined
        ? null
        : Number(profile.onTimeDeliveryRate),
    lowStockItems: inventory.filter(
      (item) => available(item) <= item.lowStockThreshold,
    ).length,
    criticalStockItems: inventory.filter((item) => available(item) <= 0).length,
    pendingPayoutMinor: payouts.reduce(
      (total, payout) => total + Number(payout.netAmountMinor),
      0,
    ),
    pendingPayoutCount: payouts.length,
    currency: payouts[0]?.currency ?? 'USD',
  };
};

/** Transit days are the platform's, and the dashboard states them as such. */
export const SHIPPING_TRANSIT_DAYS = TRANSIT_DAYS;

export interface ProductionBar {
  readonly label: string;
  readonly count: number;
  readonly share: number;
}

export interface WorkMixSlice {
  readonly label: string;
  readonly count: number;
}

export interface DashboardOrderRow {
  readonly orderId: string;
  /** The order as a person would quote it, rather than its database id. */
  readonly orderReference: string;
  readonly productName: string;
  readonly buyerName: string;
  readonly quantity: number;
  readonly stageLabel: string;
  readonly completedStages: number;
  readonly totalStages: number;
}

export interface DashboardRequestRow {
  readonly rfqId: string;
  /** The request as a person would quote it, rather than its database id. */
  readonly reference: string;
  readonly productName: string;
  readonly quantity: number;
  readonly kindLabel: string;
  readonly respondBy: Date | null;
}

export interface DashboardPartRow {
  readonly id: string;
  readonly partName: string;
  readonly minimumOrderQuantity: number | null;
  readonly available: number;
  readonly level: string;
}

export interface DashboardPayoutRow {
  readonly id: string;
  readonly buyerName: string;
  readonly orderId: string;
  /** The order as a person would quote it, rather than its database id. */
  readonly orderReference: string;
  readonly netAmountMinor: number;
  readonly status: string;
}

export interface DashboardActivityRow {
  readonly id: string;
  readonly kind: string;
  readonly subject: string;
  /**
   * What the row says about itself: the record as a person would quote it, and
   * what it was about where this shop's own rows can say. The subject id alone
   * read as `_quote_a` on screen, which tells the reader nothing.
   */
  readonly reference: string;
  readonly detail: string | null;
  /** Which of the four kinds of news this is, for the dot beside it. */
  readonly tone: 'request' | 'quote' | 'order' | 'money';
  readonly at: Date;
}

export interface DashboardSections {
  readonly production: readonly ProductionBar[];
  readonly workMix: readonly WorkMixSlice[];
  readonly orderCount: number;
  /** Orders taken in the last 30 days, and in the 30 before that. */
  readonly ordersThisPeriod: number;
  readonly ordersLastPeriod: number;
  readonly ordersInProduction: readonly DashboardOrderRow[];
  readonly requestsNeedingAction: readonly DashboardRequestRow[];
  readonly inventoryHealth: readonly DashboardPartRow[];
  readonly payouts: readonly DashboardPayoutRow[];
  readonly pendingPayoutMinor: number;
  readonly releasedPayoutMinor: number;
  readonly currency: string;
  readonly activity: readonly DashboardActivityRow[];
}

const PACKAGE_LABEL: Readonly<Record<string, string>> = {
  pcb: 'PCB',
  module_3d: '3D module',
  full_product: 'PCB + 3D',
};

/**
 * The rest of the dashboard: where the work is, what is waiting, and what moved.
 *
 * Every panel is a query against this shop's own rows. Nothing is averaged into a
 * score, and nothing is invented to fill a chart — a shop with no orders sees
 * zeros, which is the truth and is also a prompt.
 */
export const getDashboardSections = async (
  manufacturerId: ManufacturerId,
): Promise<DashboardSections> => {
  const [orders, requests, parts, payouts, payoutTotals, events] = await Promise.all([
    database().manufacturingOrder.findMany({
      where: { manufacturerId },
      include: {
        snapshot: { select: { quantity: true } },
        stages: { orderBy: { position: 'asc' } },
        rfq: {
          select: {
            buyer: { select: { displayName: true } },
            package: { select: { kind: true, product: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    database().rfqRecipient.findMany({
      where: {
        manufacturerId,
        status: { in: ['routed', 'viewed'] },
        rfq: { status: 'submitted' },
      },
      include: {
        rfq: {
          select: {
            id: true,
            quantity: true,
            responseDeadline: true,
            package: { select: { kind: true, product: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    database().inventoryItem.findMany({
      where: { manufacturerId },
      orderBy: [{ updatedAt: 'desc' }],
      take: 8,
    }),
    database().payout.findMany({
      where: { manufacturerId },
      include: {
        order: {
          select: {
            id: true,
            rfq: { select: { buyer: { select: { displayName: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    database().payout.groupBy({
      by: ['status'],
      where: { manufacturerId },
      _sum: { netAmountMinor: true },
    }),
    database().domainEvent.findMany({
      where: {
        OR: [{ actorManufacturerId: manufacturerId }, { order: { manufacturerId } }],
      },
      orderBy: { occurredAt: 'desc' },
      take: 8,
    }),
  ]);

  const live = orders.filter((order) =>
    ['confirmed', 'in_production', 'quality_check', 'ready_to_ship', 'shipped'].includes(
      order.status,
    ),
  );

  const bucket = (statuses: readonly string[]): number =>
    orders.filter((order) => statuses.includes(order.status)).length;

  const total = Math.max(1, orders.length);
  const bars: readonly ProductionBar[] = [
    { label: 'Queued', count: bucket(['awaiting_payment', 'confirmed']) },
    { label: 'In production', count: bucket(['in_production']) },
    { label: 'Quality check', count: bucket(['quality_check']) },
    { label: 'Awaiting shipment', count: bucket(['ready_to_ship']) },
    { label: 'Shipped or delivered', count: bucket(['shipped', 'delivered']) },
    {
      label: 'Needing attention',
      count: bucket([
        'cancel_requested',
        'refund_requested',
        'disputed',
        'partially_refunded',
      ]),
    },
  ].map((bar) => ({ ...bar, share: Math.round((bar.count / total) * 100) }));

  const mix = new Map<string, number>();
  for (const order of orders) {
    const label = PACKAGE_LABEL[order.rfq.package.kind] ?? order.rfq.package.kind;
    mix.set(label, (mix.get(label) ?? 0) + 1);
  }

  const available = (item: {
    readonly stockQuantity: number;
    readonly reservedQuantity: number;
  }): number => Math.max(0, item.stockQuantity - item.reservedQuantity);

  const totalFor = (status: string): number =>
    Number(
      payoutTotals.find((row) => row.status === status)?._sum.netAmountMinor ?? 0n,
    );

  const day = 24 * 60 * 60 * 1_000;
  const thirtyDaysAgo = new Date(Date.now() - 30 * day);
  const sixtyDaysAgo = new Date(Date.now() - 60 * day);

  // What a line of the log is about. The event carries a kind and the id of the
  // record it happened to; the product name comes from this shop's own rows
  // where they hold it, and is left out rather than guessed where they do not.
  const orderNames = new Map(
    orders.map((order) => [order.id, order.rfq.package.product.name] as const),
  );
  const requestNames = new Map(
    requests.map(
      (recipient) => [recipient.rfq.id, recipient.rfq.package.product.name] as const,
    ),
  );

  const describe = (
    kind: string,
    subjectId: string,
  ): {
    readonly reference: string;
    readonly detail: string | null;
    readonly tone: 'request' | 'quote' | 'order' | 'money';
  } => {
    if (kind.startsWith('payout')) {
      return {
        reference: orderReference(subjectId),
        detail: orderNames.get(subjectId) ?? null,
        tone: 'money',
      };
    }
    if (kind.startsWith('order') || kind.startsWith('production') || kind.startsWith('stage')) {
      return {
        reference: orderReference(subjectId),
        detail: orderNames.get(subjectId) ?? null,
        tone: 'order',
      };
    }
    if (kind.startsWith('quote') || kind.startsWith('substitution')) {
      return { reference: quoteReference(subjectId), detail: null, tone: 'quote' };
    }
    return {
      reference: requestReference(subjectId),
      detail: requestNames.get(subjectId) ?? null,
      tone: 'request',
    };
  };

  return {
    production: bars,
    workMix: [...mix].map(([label, count]) => ({ label, count })),
    orderCount: orders.length,
    ordersThisPeriod: orders.filter((order) => order.createdAt >= thirtyDaysAgo).length,
    ordersLastPeriod: orders.filter(
      (order) => order.createdAt >= sixtyDaysAgo && order.createdAt < thirtyDaysAgo,
    ).length,
    ordersInProduction: live.slice(0, 5).map((order) => {
      const current =
        order.stages.find((stage) => stage.status === 'in_progress') ??
        order.stages.find((stage) => stage.status === 'pending') ??
        null;
      return {
        orderId: order.id,
        orderReference: orderReference(order.id),
        productName: order.rfq.package.product.name,
        buyerName: order.rfq.buyer.displayName,
        quantity: order.snapshot?.quantity ?? 0,
        stageLabel: current === null ? 'Finished' : current.key.replace(/_/g, ' '),
        completedStages: order.stages.filter((stage) => stage.status === 'completed')
          .length,
        totalStages: Math.max(1, order.stages.length),
      };
    }),
    requestsNeedingAction: requests.map((recipient) => ({
      rfqId: recipient.rfq.id,
      reference: requestReference(recipient.rfq.id),
      productName: recipient.rfq.package.product.name,
      quantity: recipient.rfq.quantity,
      kindLabel: PACKAGE_LABEL[recipient.rfq.package.kind] ?? recipient.rfq.package.kind,
      respondBy: recipient.rfq.responseDeadline,
    })),
    inventoryHealth: parts.map((item) => ({
      id: item.id,
      partName: item.partName,
      minimumOrderQuantity: item.minimumOrderQuantity,
      available: available(item),
      level:
        available(item) <= 0
          ? 'out_of_stock'
          : available(item) <= item.lowStockThreshold
            ? 'low_stock'
            : 'in_stock',
    })),
    payouts: payouts.map((payout) => ({
      id: payout.id,
      buyerName: payout.order.rfq.buyer.displayName,
      orderId: payout.order.id,
      orderReference: orderReference(payout.order.id),
      netAmountMinor: Number(payout.netAmountMinor),
      status: payout.status,
    })),
    pendingPayoutMinor: totalFor('pending_release'),
    releasedPayoutMinor: totalFor('released'),
    currency: payouts[0]?.currency ?? 'USD',
    activity: events.map((event) => {
      const named = describe(event.kind, event.subjectId);
      return {
        id: event.id,
        kind: event.kind,
        subject: event.subjectId,
        reference: named.reference,
        detail: named.detail,
        tone: named.tone,
        at: event.occurredAt,
      };
    }),
  };
};
