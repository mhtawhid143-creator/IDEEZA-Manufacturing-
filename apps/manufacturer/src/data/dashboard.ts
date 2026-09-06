import {
  OPEN_RFQ_STATUSES,
  TRANSIT_DAYS,
  orderReference,
  quoteReference,
  requestReference,
  stageDefinition,
  type ManufacturerId,
} from '@ideeza/domain';
import { database } from '@/lib/db.js';

export interface HeadlineTiles {
  readonly openRfqs: number;
  readonly newThisWeek: number;
  readonly needResponse: number;
  readonly quotesSubmitted: number;
  readonly quotesAccepted: number;
  /**
   * How many of the quotes that got an answer were taken (UIUX-106).
   *
   * Null until at least one has been decided: a shop with nothing decided has
   * no win rate, and printing 0% would read as having lost every time rather
   * than as not having heard yet. Quotes still waiting on a buyer are out of
   * the denominator for the same reason — they are not losses, only silence.
   */
  readonly quoteWinRate: number | null;
  readonly quotesDecided: number;
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
    quotesLost,
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
    // UIUX-106: the quotes a buyer has actually answered, whichever way. A
    // withdrawn quote is the shop's own decision and not a loss, so it is not
    // counted against the win rate.
    database().quote.count({
      where: { manufacturerId, status: { in: ['rejected', 'expired'] } },
    }),
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

  // Of the quotes a buyer answered, how many were taken. Null while none have
  // been answered — see the note on the field.
  const quotesDecided = quotesAccepted + quotesLost;

  return {
    openRfqs,
    newThisWeek,
    needResponse,
    quotesSubmitted,
    quotesAccepted,
    quotesDecided,
    quoteWinRate: quotesDecided === 0 ? null : quotesAccepted / quotesDecided,
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
  /**
   * Which kind of work this order is, stated rather than inferred (UIUX-114).
   * A reader should not have to recognise "solder mask" as a board word to know
   * what a row is, and once both kinds sit in one table that inference fails.
   */
  readonly kindLabel: string;
  readonly completedStages: number;
  readonly totalStages: number;
  /**
   * Past the date this shop's own accepted lead time promised (UIUX-200): the
   * track has to be able to say so, because a row that is behind and a row that
   * is on time must not look alike.
   */
  readonly late: boolean;
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
  /**
   * The code a shop would actually reorder against (UIUX-121). Two rows can
   * carry the same generic name — "SMD resistor" — and mean different parts.
   */
  readonly sku: string;
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
  /** Where the record can be read, when this shop has a screen for it. */
  readonly href: string | null;
  /** Which of the four kinds of news this is, for the dot beside it. */
  readonly tone: 'request' | 'quote' | 'order' | 'money';
  readonly at: Date;
}

/**
 * Which kind of work the production panel is scoped to.
 *
 * UIUX-113 asked for one panel that can be narrowed rather than two panels
 * built side by side: the stages are universal, so only the population changes.
 */
export type WorkScope = 'all' | 'pcb' | 'module_3d';

export interface DashboardSections {
  /**
   * Exactly the four universal stages, in order, named the same for a board
   * shop and a printing shop. Process detail belongs on the order, not here.
   */
  readonly production: readonly ProductionBar[];
  /**
   * Orders needing attention — a cancellation asked for, a refund claimed, a
   * case open. Counted apart from the four because it is not a place in a
   * sequence: it can happen at any of them.
   */
  readonly needingAttention: number;
  /**
   * Past the date the accepted lead time promised (UIUX-106).
   *
   * It sits beside "needing attention" for the reason UIUX-111 gave about that
   * one: being behind is a cross-cutting exception that can happen at any of the
   * four stages, so it is a flag rather than a place in the sequence. It is here
   * rather than in a headline tile because this is the panel a shop reads to
   * find out what is wrong on the floor.
   */
  readonly pastTheQuotedDate: number;
  /** Already gone out. Not a production stage, but not a number to lose either. */
  readonly shippedOrDelivered: number;
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
  options: { readonly work?: WorkScope } = {},
): Promise<DashboardSections> => {
  const [orders, requests, parts, payouts, shopQuotes, payoutTotals, events] = await Promise.all([
    database().manufacturingOrder.findMany({
      where: { manufacturerId },
      include: {
        snapshot: { select: { quantity: true, leadTimeDays: true } },
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
    database().quote.findMany({
      where: { manufacturerId },
      select: {
        id: true,
        rfq: { select: { package: { select: { product: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
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

  const scope = options.work ?? 'all';
  const inScope = (order: { readonly rfq: { readonly package: { readonly kind: string } } }): boolean =>
    scope === 'all' ||
    (scope === 'pcb'
      ? order.rfq.package.kind === 'pcb' || order.rfq.package.kind === 'full_product'
      : order.rfq.package.kind === 'module_3d' || order.rfq.package.kind === 'full_product');

  const bucket = (statuses: readonly string[]): number =>
    orders.filter((order) => inScope(order) && statuses.includes(order.status)).length;

  const total = Math.max(1, orders.length);
  /*
   * The four universal stages, and nothing else (UIUX-113).
   *
   * "Shipped or delivered" and "Needing attention" used to sit in this list and
   * do not belong in it: the first is after production, and the second can
   * happen during any of the four. Both are still counted — a number a shop
   * used to see should not vanish because it moved out of a list — but they are
   * reported beside the stages rather than inside them.
   */
  const bars: readonly ProductionBar[] = [
    { label: 'Queued', count: bucket(['awaiting_payment', 'confirmed']) },
    { label: 'In production', count: bucket(['in_production']) },
    { label: 'Quality check', count: bucket(['quality_check']) },
    { label: 'Awaiting shipment', count: bucket(['ready_to_ship']) },
  ].map((bar) => ({ ...bar, share: Math.round((bar.count / total) * 100) }));

  const shippedOrDelivered = bucket(['shipped', 'delivered']);
  const needingAttention = bucket([
    'cancel_requested',
    'refund_requested',
    'disputed',
    'partially_refunded',
  ]);
  // Behind the date it promised, judged the way the orders list judges it: the
  // accepted lead time, counted from the moment the funds were secured.
  const pastTheQuotedDate = live.filter((order) => {
    if (!inScope(order)) return false;
    if (order.confirmedAt === null || order.snapshot === null) return false;
    if (order.status === 'shipped') return false;
    const due = order.confirmedAt.getTime() + order.snapshot.leadTimeDays * DAY;
    return due < Date.now();
  }).length;

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
  const quoteNames = new Map(
    shopQuotes.map((quote) => [quote.id, quote.rfq.package.product.name] as const),
  );

  const describe = (
    kind: string,
    subjectId: string,
  ): {
    readonly reference: string;
    readonly detail: string | null;
    readonly href: string | null;
    readonly tone: 'request' | 'quote' | 'order' | 'money';
  } => {
    if (kind.startsWith('payout')) {
      const name = orderNames.get(subjectId) ?? null;
      return {
        reference: orderReference(subjectId),
        detail: name,
        href: name === null ? null : `/orders/${subjectId}`,
        tone: 'money',
      };
    }
    if (kind.startsWith('order') || kind.startsWith('production') || kind.startsWith('stage')) {
      const name = orderNames.get(subjectId) ?? null;
      return {
        reference: orderReference(subjectId),
        detail: name,
        href: name === null ? null : `/orders/${subjectId}`,
        tone: 'order',
      };
    }
    if (kind.startsWith('quote') || kind.startsWith('substitution')) {
      const name = quoteNames.get(subjectId) ?? null;
      return {
        reference: quoteReference(subjectId),
        detail: name,
        href: name === null ? null : `/quotes/${subjectId}`,
        tone: 'quote',
      };
    }
    const name = requestNames.get(subjectId) ?? null;
    return {
      reference: requestReference(subjectId),
      detail: name,
      href: name === null ? null : `/rfqs/${subjectId}`,
      tone: 'request',
    };
  };

  return {
    production: bars,
    needingAttention,
    pastTheQuotedDate,
    shippedOrDelivered,
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
      const due =
        order.confirmedAt === null || order.snapshot === null
          ? null
          : order.confirmedAt.getTime() + order.snapshot.leadTimeDays * DAY;
      return {
        orderId: order.id,
        orderReference: orderReference(order.id),
        productName: order.rfq.package.product.name,
        buyerName: order.rfq.buyer.displayName,
        quantity: order.snapshot?.quantity ?? 0,
        // The stage's own name from the domain, not the key with its
        // underscores rubbed out (UIUX-204): a stage that reads "in production"
        // here and "In production" on the order itself is two names for one
        // thing.
        stageLabel: current === null ? 'Finished' : stageDefinition(current.key).label,
        kindLabel: PACKAGE_LABEL[order.rfq.package.kind] ?? order.rfq.package.kind,
        completedStages: order.stages.filter((stage) => stage.status === 'completed')
          .length,
        totalStages: Math.max(1, order.stages.length),
        late: due !== null && order.status !== 'shipped' && due < Date.now(),
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
      sku: item.sku,
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
        href: named.href,
        tone: named.tone,
        at: event.occurredAt,
      };
    }),
  };
};
