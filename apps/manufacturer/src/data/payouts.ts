import { asId, type ManufacturerId, type OrderId } from '@ideeza/domain';
import { database } from '@/lib/db.js';

export interface PayoutRow {
  readonly id: string;
  readonly orderId: OrderId;
  readonly productName: string;
  readonly buyerName: string;
  readonly status: string;
  readonly currency: string;
  readonly orderAmountMinor: number;
  readonly platformFeeMinor: number;
  readonly netAmountMinor: number;
  readonly releasedAt: Date | null;
  readonly createdAt: Date;
  /** The event the release was made against, which is what makes it auditable. */
  readonly releaseTriggerKind: string | null;
}

export interface EarningsSummary {
  readonly currency: string;
  readonly pendingReleaseMinor: number;
  readonly releasedMinor: number;
  readonly refundedMinor: number;
  readonly disputedMinor: number;
  readonly platformFeesMinor: number;
  /** Released and not yet withdrawn. There is no bank rail in this build. */
  readonly availableMinor: number;
}

export interface PayoutFilters {
  readonly status?: string | 'all';
  readonly search?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface PayoutPage {
  readonly rows: readonly PayoutRow[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

const include = {
  order: {
    select: {
      id: true,
      rfq: {
        select: {
          buyer: { select: { displayName: true } },
          package: { select: { product: { select: { name: true } } } },
        },
      },
    },
  },
  releaseTriggerEvent: { select: { kind: true } },
} as const;

/**
 * What this shop has earned, and what is still held.
 *
 * A payout exists per order and moves only against a documented event, so the row
 * carries which event released it. Nothing here can be released from this screen:
 * that is the buyer's confirmation, the review window closing, or a resolved
 * case.
 */
export const listPayouts = async (
  manufacturerId: ManufacturerId,
  filters: PayoutFilters = {},
): Promise<PayoutPage> => {
  const search = filters.search?.trim() ?? '';
  const pageSize = filters.pageSize ?? 10;
  const status = filters.status ?? 'all';

  const where = {
    manufacturerId,
    ...(status === 'all' ? {} : { status: status as never }),
    ...(filters.from === undefined && filters.to === undefined
      ? {}
      : {
          createdAt: {
            ...(filters.from === undefined ? {} : { gte: filters.from }),
            ...(filters.to === undefined ? {} : { lte: filters.to }),
          },
        }),
    ...(search === ''
      ? {}
      : {
          OR: [
            { id: { contains: search, mode: 'insensitive' as const } },
            { orderId: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
  };

  const total = await database().payout.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);

  const rows = await database().payout.findMany({
    where,
    include,
    orderBy: [{ createdAt: 'desc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    rows: rows.map((row) => ({
      id: row.id,
      orderId: asId<OrderId>(row.orderId),
      productName: row.order.rfq.package.product.name,
      buyerName: row.order.rfq.buyer.displayName,
      status: row.status,
      currency: row.currency,
      orderAmountMinor: Number(row.orderAmountMinor),
      platformFeeMinor: Number(row.platformFeeMinor),
      netAmountMinor: Number(row.netAmountMinor),
      releasedAt: row.releasedAt,
      createdAt: row.createdAt,
      releaseTriggerKind: row.releaseTriggerEvent?.kind ?? null,
    })),
    total,
    page,
    pageCount,
  };
};

export const earningsSummary = async (
  manufacturerId: ManufacturerId,
): Promise<EarningsSummary> => {
  const rows = await database().payout.findMany({
    where: { manufacturerId },
    select: {
      status: true,
      currency: true,
      orderAmountMinor: true,
      platformFeeMinor: true,
      netAmountMinor: true,
    },
  });

  const sum = (status: string): number =>
    rows
      .filter((row) => row.status === status)
      .reduce((total, row) => total + Number(row.netAmountMinor), 0);

  return {
    currency: rows[0]?.currency ?? 'USD',
    pendingReleaseMinor: sum('pending_release'),
    releasedMinor: sum('released'),
    refundedMinor: sum('refunded'),
    disputedMinor: sum('disputed'),
    platformFeesMinor: rows.reduce(
      (total, row) => total + Number(row.platformFeeMinor),
      0,
    ),
    availableMinor: sum('released'),
  };
};
