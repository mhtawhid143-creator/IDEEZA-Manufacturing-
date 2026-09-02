import {
  CANONICAL_STAGES,
  applyTransition,
  asId,
  assertProductionMayStart,
  assertStageProgression,
  isFundingSecured,
  orderMachine,
  orderSchedule,
  stageDefinition,
  type ManufacturerId,
  type OrderId,
  type OrderStatus,
  type ProductionProgressStatus,
  type ProductionStageKey,
  type UserId,
} from '@ideeza/domain';
import { toDatabaseEventKind } from '@ideeza/db';
import { database } from '@/lib/db.js';

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface OrderRow {
  readonly orderId: OrderId;
  readonly productName: string;
  readonly buyerName: string;
  readonly status: OrderStatus;
  readonly quantity: number;
  readonly currency: string;
  readonly unitPriceMinor: number;
  readonly totalPriceMinor: number;
  readonly fundingSecured: boolean;
  readonly currentStageLabel: string | null;
  readonly completedStages: number;
  readonly totalStages: number;
  readonly openAlerts: number;
  /**
   * The case on this order, when there is one.
   *
   * An order carries its own status, but a dispute is not always the order's
   * status — one can be raised and answered while production continues. So the
   * row says whether a case exists and where it stands, and the list can act on
   * it without a second query per row.
   */
  readonly disputeId: string | null;
  readonly disputeStatus: string | null;
  readonly createdAt: Date;
  readonly confirmedAt: Date | null;
  readonly estimatedShipAt: Date | null;
  readonly late: boolean;
}

export interface OrderCounters {
  readonly total: number;
  readonly awaitingFunding: number;
  readonly inFlight: number;
  readonly late: number;
  readonly completed: number;
  readonly inTrouble: number;
}

export interface OrderFilters {
  readonly status?: OrderStatus | 'all' | 'in_flight' | 'late';
  readonly search?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface OrderPage {
  readonly rows: readonly OrderRow[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

/** Statuses where the shop still has work to do or money to be paid. */
const IN_FLIGHT: readonly OrderStatus[] = [
  'confirmed',
  'in_production',
  'quality_check',
  'ready_to_ship',
  'shipped',
  'delivered',
];

const orderInclude = {
  rfq: {
    select: {
      buyer: { select: { displayName: true } },
      package: { select: { product: { select: { name: true } } } },
    },
  },
  snapshot: true,
  payment: { select: { status: true } },
  stages: { orderBy: { position: 'asc' as const } },
  _count: { select: { alerts: true } },
  disputes: {
    orderBy: { createdAt: 'desc' as const },
    select: { id: true, status: true, resolvedAt: true },
  },
} as const;

/**
 * The orders this shop is building.
 *
 * Every one of them started as a quote this shop wrote, and the terms are the
 * frozen snapshot rather than the quote row — the quote can no longer change, and
 * the snapshot is what both sides agreed.
 */
export const listOrders = async (
  manufacturerId: ManufacturerId,
  filters: OrderFilters = {},
  now: Date = new Date(),
): Promise<OrderPage> => {
  const search = filters.search?.trim() ?? '';
  const pageSize = filters.pageSize ?? 10;
  const status = filters.status ?? 'all';

  // One `status` key, however it is narrowed: "in flight" is a set of statuses
  // and "late" is a judgement made after the schedule is worked out.
  const statusWhere =
    status === 'in_flight'
      ? { status: { in: [...IN_FLIGHT] } }
      : status === 'all' || status === 'late'
        ? {}
        : { status };

  const where = {
    manufacturerId,
    ...statusWhere,
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
          rfq: {
            package: {
              product: { name: { contains: search, mode: 'insensitive' as const } },
            },
          },
        }),
  };

  const all = await database().manufacturingOrder.findMany({
    where,
    include: orderInclude,
    orderBy: [{ createdAt: 'desc' }],
  });

  const openAlertCounts = await database().inventoryAlert.groupBy({
    by: ['orderId'],
    where: { orderId: { in: all.map((order) => order.id) }, status: 'open' },
    _count: { _all: true },
  });

  const mapped: OrderRow[] = all.map((order) => {
    const stages = order.stages;
    const current =
      stages.find((stage) => stage.status === 'in_progress') ??
      stages.find((stage) => stage.status === 'pending') ??
      null;
    const schedule =
      order.confirmedAt === null || order.snapshot === null
        ? null
        : orderSchedule({
            confirmedAt: order.confirmedAt,
            leadTimeDays: order.snapshot.leadTimeDays,
            shippingChoice: order.shippingChoice,
          });

    const shipped = stages.find((stage) => stage.key === 'shipped');
    const late =
      schedule !== null &&
      shipped?.status !== 'completed' &&
      IN_FLIGHT.includes(order.status) &&
      schedule.estimatedShipAt.getTime() < now.getTime();

    return {
      orderId: asId<OrderId>(order.id),
      productName: order.rfq.package.product.name,
      buyerName: order.rfq.buyer.displayName,
      status: order.status,
      quantity: order.snapshot?.quantity ?? 0,
      currency: order.snapshot?.currency ?? 'USD',
      unitPriceMinor: Number(order.snapshot?.unitPriceMinor ?? 0),
      totalPriceMinor: Number(order.snapshot?.totalPriceMinor ?? 0),
      fundingSecured: isFundingSecured(order.payment?.status),
      currentStageLabel: current === null ? null : stageDefinition(current.key).label,
      completedStages: stages.filter((stage) => stage.status === 'completed').length,
      totalStages: Math.max(stages.length, CANONICAL_STAGES.length),
      openAlerts:
        openAlertCounts.find((row) => row.orderId === order.id)?._count._all ?? 0,
      // Open first: an unanswered case is the one a shop has to act on, and a
      // resolved one is a record it may still want to read.
      disputeId:
        (order.disputes.find((entry) => entry.resolvedAt === null) ?? order.disputes[0])?.id ??
        null,
      disputeStatus:
        (order.disputes.find((entry) => entry.resolvedAt === null) ?? order.disputes[0])
          ?.status ?? null,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      estimatedShipAt: schedule?.estimatedShipAt ?? null,
      late,
    };
  });

  // "Late" is a judgement about the clock and the quoted lead time, so it is
  // filtered after the schedule is worked out rather than in the query.
  const visible = status === 'late' ? mapped.filter((row) => row.late) : mapped;

  const total = visible.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);

  return {
    rows: visible.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageCount,
  };
};

export const orderCounters = async (
  manufacturerId: ManufacturerId,
  now: Date = new Date(),
): Promise<OrderCounters> => {
  const rows = await listOrders(
    manufacturerId,
    { pageSize: Number.MAX_SAFE_INTEGER },
    now,
  );

  return {
    total: rows.total,
    awaitingFunding: rows.rows.filter((row) => row.status === 'awaiting_payment').length,
    inFlight: rows.rows.filter((row) => IN_FLIGHT.includes(row.status)).length,
    late: rows.rows.filter((row) => row.late).length,
    completed: rows.rows.filter((row) => row.status === 'completed').length,
    inTrouble: rows.rows.filter((row) =>
      [
        'cancel_requested',
        'cancelled',
        'refund_requested',
        'refunded',
        'partially_refunded',
        'disputed',
      ].includes(row.status),
    ).length,
  };
};

export interface StageTaskView {
  readonly id: string;
  readonly label: string;
  readonly status: ProductionProgressStatus;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
}

export interface StageView {
  readonly id: string;
  readonly key: ProductionStageKey;
  readonly position: number;
  readonly label: string;
  readonly status: ProductionProgressStatus;
  readonly advancedBy: 'system' | 'manufacturer' | 'buyer';
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly note: string | null;
  readonly tasks: readonly StageTaskView[];
  readonly evidenceCount: number;
  /** True when this shop may move it, with the reason when it may not. */
  readonly movable: boolean;
  readonly blockedReason: string | null;
}

export interface OrderEvidenceView {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly stageKey: ProductionStageKey | null;
  readonly capturedAt: Date;
}

export interface OrderAlertView {
  readonly id: string;
  readonly partReference: string;
  readonly partName: string;
  readonly shortfallQuantity: number;
  readonly note: string;
  readonly status: string;
  readonly decisionNote: string | null;
  readonly decidedAt: Date | null;
  readonly raisedAt: Date;
  readonly suggestedPartName: string | null;
  readonly priceImpactMinor: number;
  readonly creditMinor: number;
  readonly leadTimeImpactDays: number;
}

export interface OrderDetail extends OrderRow {
  readonly rfqId: string;
  readonly quoteId: string;
  readonly buyerId: UserId;
  readonly creatorName: string;
  readonly paymentStatus: string | null;
  readonly paidMinor: number | null;
  readonly shippingEstimateMinor: number | null;
  readonly toolingSetupCostMinor: number | null;
  readonly leadTimeDays: number;
  readonly materialProcessNotes: string;
  readonly warrantyTerms: string | null;
  readonly terms: string;
  readonly snapshotChecksum: string;
  readonly approvedSubstitutionIds: readonly string[];
  readonly shipTo: {
    readonly line1: string;
    readonly line2: string | null;
    readonly city: string;
    readonly region: string | null;
    readonly postalCode: string | null;
    readonly countryCode: string;
  };
  readonly shippingChoice: string;
  readonly schedule: {
    readonly estimatedShipAt: Date;
    readonly estimatedDeliveryAt: Date;
  } | null;
  readonly stages: readonly StageView[];
  readonly evidence: readonly OrderEvidenceView[];
  readonly alerts: readonly OrderAlertView[];
  readonly reviewWindowEndsAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly completedAt: Date | null;
  readonly cancellable: boolean;
}

/**
 * One order of this shop's, in full.
 *
 * The terms come from the immutable snapshot, so what this screen shows is what
 * the buyer accepted — not what the quote row happens to say now. Whether a stage
 * may be moved is worked out here, by the domain, so the menu on a stage and the
 * refusal behind it can never disagree.
 */
export const getOrder = async (
  manufacturerId: ManufacturerId,
  orderId: OrderId,
  now: Date = new Date(),
): Promise<OrderDetail | null> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, manufacturerId },
    include: {
      ...orderInclude,
      rfq: {
        select: {
          id: true,
          buyerId: true,
          buyer: { select: { displayName: true } },
          package: {
            select: {
              product: {
                select: { name: true, owner: { select: { displayName: true } } },
              },
            },
          },
        },
      },
      stages: {
        orderBy: { position: 'asc' },
        include: {
          tasks: { orderBy: { position: 'asc' } },
          evidence: { select: { id: true } },
        },
      },
      alerts: { orderBy: { raisedAt: 'desc' } },
    },
  });
  if (order === null || order.snapshot === null) return null;

  const evidence = await database().evidence.findMany({
    where: { OR: [{ orderId: order.id }, { productionStage: { orderId: order.id } }] },
    orderBy: { capturedAt: 'desc' },
    include: { productionStage: { select: { key: true } } },
  });

  const funded = isFundingSecured(order.payment?.status);
  const openAlerts = order.alerts.filter((alert) => alert.status === 'open').length;

  const stages: readonly StageView[] = order.stages.map((stage) => {
    const definition = stageDefinition(stage.key);

    let blockedReason: string | null = null;
    if (definition.advancedBy !== 'manufacturer') {
      blockedReason =
        definition.advancedBy === 'buyer'
          ? 'The buyer moves this one.'
          : 'The platform moves this one.';
    } else if (stage.status === 'completed') {
      blockedReason = 'Already completed. A completed stage is never reopened.';
    } else if (!funded) {
      blockedReason = 'Not funded yet, so nothing on the shop floor can move.';
    } else if (openAlerts > 0) {
      blockedReason = `${openAlerts} part shortage${
        openAlerts === 1 ? '' : 's'
      } is waiting on the buyer's answer.`;
    } else {
      // The domain decides whether it may move; the wording is ours, because the
      // shop reads it and an invariant's code is not an explanation.
      const earlier = order.stages
        .filter((row) => row.position < stage.position)
        .find((row) => row.status !== 'completed');
      if (earlier !== undefined) {
        blockedReason = `Waiting for ${stageDefinition(earlier.key).label} to finish.`;
      } else {
        try {
          assertProductionMayStart({
            orderStatus: order.status,
            paymentStatus: order.payment?.status,
          });
          assertStageProgression(
            order.stages.map((row) => ({
              id: asId(row.id),
              orderId: asId<OrderId>(row.orderId),
              key: row.key,
              position: row.position,
              status: row.status,
            })) as never,
            stage.key,
          );
        } catch (error) {
          blockedReason =
            error instanceof Error
              ? `This stage cannot move yet: ${error.message}`
              : 'This stage cannot move yet.';
        }
      }
    }

    return {
      id: stage.id,
      key: stage.key,
      position: stage.position,
      label: definition.label,
      status: stage.status,
      advancedBy: definition.advancedBy,
      startedAt: stage.startedAt,
      completedAt: stage.completedAt,
      note: stage.note,
      tasks: stage.tasks.map((task) => ({
        id: task.id,
        label: task.label,
        status: task.status,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
      })),
      evidenceCount: stage.evidence.length,
      movable: blockedReason === null,
      blockedReason,
    };
  });

  const current =
    stages.find((stage) => stage.status === 'in_progress') ??
    stages.find((stage) => stage.status === 'pending') ??
    null;
  const schedule =
    order.confirmedAt === null
      ? null
      : orderSchedule({
          confirmedAt: order.confirmedAt,
          leadTimeDays: order.snapshot.leadTimeDays,
          shippingChoice: order.shippingChoice,
        });
  const shipped = stages.find((stage) => stage.key === 'shipped');

  return {
    orderId: asId<OrderId>(order.id),
    rfqId: order.rfqId,
    quoteId: order.acceptedQuoteId,
    productName: order.rfq.package.product.name,
    creatorName: order.rfq.package.product.owner.displayName,
    buyerId: asId<UserId>(order.rfq.buyerId),
    buyerName: order.rfq.buyer.displayName,
    status: order.status,
    quantity: order.snapshot.quantity,
    currency: order.snapshot.currency,
    unitPriceMinor: Number(order.snapshot.unitPriceMinor),
    totalPriceMinor: Number(order.snapshot.totalPriceMinor),
    shippingEstimateMinor:
      order.snapshot.shippingEstimateMinor === null
        ? null
        : Number(order.snapshot.shippingEstimateMinor),
    toolingSetupCostMinor:
      order.snapshot.toolingSetupCostMinor === null
        ? null
        : Number(order.snapshot.toolingSetupCostMinor),
    leadTimeDays: order.snapshot.leadTimeDays,
    materialProcessNotes: order.snapshot.materialProcessNotes,
    warrantyTerms: order.snapshot.warrantyTerms,
    terms: order.snapshot.terms,
    snapshotChecksum: order.snapshot.checksum,
    approvedSubstitutionIds: order.snapshot.approvedSubstitutionIds,
    fundingSecured: funded,
    paymentStatus: order.payment?.status ?? null,
    paidMinor: null,
    shipTo: {
      line1: order.shipToLine1,
      line2: order.shipToLine2,
      city: order.shipToCity,
      region: order.shipToRegion,
      postalCode: order.shipToPostalCode,
      countryCode: order.shipToCountryCode,
    },
    shippingChoice: order.shippingChoice,
    schedule:
      schedule === null
        ? null
        : {
            estimatedShipAt: schedule.estimatedShipAt,
            estimatedDeliveryAt: schedule.estimatedDeliveryAt,
          },
    currentStageLabel: current === null ? null : current.label,
    completedStages: stages.filter((stage) => stage.status === 'completed').length,
    totalStages: stages.length,
    openAlerts,
    disputeId:
      (order.disputes.find((entry) => entry.resolvedAt === null) ?? order.disputes[0])?.id ??
      null,
    disputeStatus:
      (order.disputes.find((entry) => entry.resolvedAt === null) ?? order.disputes[0])?.status ??
      null,
    stages,
    evidence: evidence.map((record) => ({
      id: record.id,
      kind: record.kind,
      title: record.title,
      stageKey: record.productionStage?.key ?? null,
      capturedAt: record.capturedAt,
    })),
    alerts: order.alerts.map((alert) => ({
      id: alert.id,
      partReference: alert.partReference,
      partName: alert.partName,
      shortfallQuantity: alert.shortfallQuantity,
      note: alert.note,
      status: alert.status,
      decisionNote: alert.decisionNote,
      decidedAt: alert.decidedAt,
      raisedAt: alert.raisedAt,
      suggestedPartName: alert.suggestedPartName,
      priceImpactMinor: Number(alert.priceImpactMinor),
      creditMinor: Number(alert.creditMinor),
      leadTimeImpactDays: alert.leadTimeImpactDays,
    })),
    createdAt: order.createdAt,
    confirmedAt: order.confirmedAt,
    deliveredAt: order.deliveredAt,
    completedAt: order.completedAt,
    reviewWindowEndsAt: order.reviewWindowEndsAt,
    estimatedShipAt: schedule?.estimatedShipAt ?? null,
    late:
      schedule !== null &&
      shipped?.status !== 'completed' &&
      IN_FLIGHT.includes(order.status) &&
      schedule.estimatedShipAt.getTime() < now.getTime(),
    cancellable: ['confirmed', 'in_production', 'quality_check'].includes(order.status),
  };
};

export type OrderOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * Moves one production stage, and nothing else.
 *
 * The rules are the domain's: the platform has to be holding the funds, the
 * stages go in their canonical order, a completed stage is never reopened, and a
 * shortage the buyer has not answered stops the line — because building past an
 * unanswered shortage is how an order ends up made of parts nobody agreed to.
 */
export const moveStage = async (
  manufacturerId: ManufacturerId,
  actorId: UserId,
  orderId: OrderId,
  key: ProductionStageKey,
  to: 'in_progress' | 'completed',
  note: string | undefined,
  now: Date = new Date(),
): Promise<OrderOutcome> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, manufacturerId },
    include: {
      payment: { select: { status: true } },
      stages: { orderBy: { position: 'asc' } },
      alerts: { where: { status: 'open' }, select: { id: true } },
      tasks: { select: { id: true, stageId: true, status: true } },
    },
  });
  if (order === null) return { ok: false, message: 'That order is not yours.' };

  const definition = stageDefinition(key);
  if (definition.advancedBy !== 'manufacturer') {
    return {
      ok: false,
      message:
        definition.advancedBy === 'buyer'
          ? 'The buyer moves this stage.'
          : 'The platform moves this stage.',
    };
  }

  try {
    assertProductionMayStart({
      orderStatus: order.status,
      paymentStatus: order.payment?.status,
    });
    assertStageProgression(
      order.stages.map((row) => ({
        id: asId(row.id),
        orderId: asId<OrderId>(row.orderId),
        key: row.key,
        position: row.position,
        status: row.status,
      })) as never,
      key,
    );
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'that stage cannot move yet',
    };
  }

  if (order.alerts.length > 0) {
    return {
      ok: false,
      message: `${order.alerts.length} shortage${
        order.alerts.length === 1 ? '' : 's'
      } on this order is waiting on the buyer. Production cannot move past it.`,
    };
  }

  const stage = order.stages.find((row) => row.key === key);
  if (stage === undefined) {
    return { ok: false, message: 'That stage is not on this order.' };
  }
  if (to === 'in_progress' && stage.status === 'in_progress') {
    return { ok: false, message: 'That stage is already in progress.' };
  }

  // Completing a stage completes what is under it: a stage that is done with
  // tasks left open would be a claim the shop floor did not make.
  const openTasks = order.tasks.filter(
    (task) => task.stageId === stage.id && task.status !== 'completed',
  );

  const orderStatusFor: Partial<Record<ProductionStageKey, OrderStatus>> = {
    in_production: 'in_production',
    quality_check: 'quality_check',
    ready_to_ship: 'ready_to_ship',
    shipped: 'shipped',
    delivered: 'delivered',
  };

  // The order's own status follows the stage, and it only ever moves through
  // its machine. Starting a stage brings the order to that stage's status;
  // completing one does the same when the order has not reached it yet, since a
  // stage may be completed in one move without being started first (the
  // shipment is recorded that way). The order is never moved backwards: a stage
  // behind where the order already stands leaves the status alone. Asking the
  // machine first is what stops a shop from delivering an order that is
  // disputed, has a refund open, or was never shipped — the machine has no such
  // transition, so the whole move is refused before anything is written.
  const nextStatus = orderStatusFor[key];
  const statusLine = Object.values(orderStatusFor);
  const reachedIndex = statusLine.indexOf(order.status);
  const nextIndex = nextStatus === undefined ? -1 : statusLine.indexOf(nextStatus);
  const alreadyThereOrPast = reachedIndex !== -1 && reachedIndex >= nextIndex;
  let orderStatusAfter: OrderStatus | undefined;
  try {
    if (nextStatus !== undefined && !alreadyThereOrPast) {
      orderStatusAfter = applyTransition(orderMachine, order.status, nextStatus, {
        actorRole: 'manufacturer',
        paymentStatus: order.payment?.status,
      });
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `The order cannot move from "${order.status}" here: ${error.message}`
          : 'the order cannot move here',
    };
  }

  await database().$transaction(async (transaction) => {
    await transaction.productionStage.update({
      where: { id: stage.id },
      data: {
        status: to,
        ...(stage.startedAt === null ? { startedAt: now } : {}),
        ...(to === 'completed' ? { completedAt: now } : {}),
        ...(note === undefined || note.trim() === '' ? {} : { note: note.trim() }),
      },
    });

    if (to === 'completed' && openTasks.length > 0) {
      await transaction.productionTask.updateMany({
        where: { id: { in: openTasks.map((task) => task.id) } },
        data: { status: 'completed', completedAt: now },
      });
    }

    if (orderStatusAfter !== undefined) {
      await transaction.manufacturingOrder.update({
        where: { id: orderId },
        data: {
          status: orderStatusAfter,
          ...(orderStatusAfter === 'delivered' ? { deliveredAt: now } : {}),
        },
      });
    }

    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind(
          to === 'completed' ? 'order.stage_advanced' : 'order.production_started',
        ),
        actorRole: 'manufacturer',
        actorUserId: actorId,
        actorManufacturerId: manufacturerId,
        subjectKind: 'production_stage',
        subjectId: stage.id,
        orderId,
        payload: { key, status: to, ...(note === undefined ? {} : { note }) },
        occurredAt: now,
      },
    });
  });

  return { ok: true };
};

/** Ticks one shop-floor task inside a stage. */
export const setTaskStatus = async (
  manufacturerId: ManufacturerId,
  actorId: UserId,
  orderId: OrderId,
  taskId: string,
  to: 'in_progress' | 'completed',
  now: Date = new Date(),
): Promise<OrderOutcome> => {
  const task = await database().productionTask.findFirst({
    where: { id: taskId, orderId, order: { manufacturerId } },
    include: {
      stage: { select: { id: true, key: true, status: true } },
      order: { select: { status: true, payment: { select: { status: true } } } },
    },
  });
  if (task === null) return { ok: false, message: 'That task is not on your order.' };

  try {
    assertProductionMayStart({
      orderStatus: task.order.status,
      paymentStatus: task.order.payment?.status,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'production cannot move yet',
    };
  }

  if (task.stage.status === 'completed') {
    return {
      ok: false,
      message: 'That stage is already completed, so its tasks cannot change.',
    };
  }

  await database().$transaction(async (transaction) => {
    await transaction.productionTask.update({
      where: { id: taskId },
      data: {
        status: to,
        ...(task.startedAt === null ? { startedAt: now } : {}),
        ...(to === 'completed' ? { completedAt: now } : {}),
      },
    });
    // Ticking the first task starts the stage: the shop floor has begun, and the
    // buyer's screen should say so.
    if (task.stage.status === 'pending') {
      await transaction.productionStage.update({
        where: { id: task.stage.id },
        data: { status: 'in_progress', startedAt: now },
      });
    }
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('order.task_updated'),
        actorRole: 'manufacturer',
        actorUserId: actorId,
        actorManufacturerId: manufacturerId,
        subjectKind: 'production_task',
        subjectId: taskId,
        orderId,
        payload: { label: task.label, status: to },
        occurredAt: now,
      },
    });
  });

  return { ok: true };
};

export const EVIDENCE_KINDS = [
  'quality_report',
  'measurement_data',
  'photo',
  'shipping_record',
  'delivery_record',
  'manufacturer_statement',
] as const;
export type ManufacturerEvidenceKind = (typeof EVIDENCE_KINDS)[number];

/**
 * Attaches a record to a stage of the order.
 *
 * Evidence is what a claim rests on later, so it is bound to exactly one context
 * — here, one production stage — and never edited. This build holds no file
 * bytes, so a record is its title, its kind and what it says; that is stated on
 * the screen rather than hidden behind an upload box that would lose the file.
 */
export const attachEvidence = async (
  manufacturerId: ManufacturerId,
  actorId: UserId,
  orderId: OrderId,
  stageId: string,
  kind: ManufacturerEvidenceKind,
  title: string,
  detail: string | undefined,
  now: Date = new Date(),
): Promise<OrderOutcome> => {
  const stage = await database().productionStage.findFirst({
    where: { id: stageId, orderId, order: { manufacturerId } },
    select: { id: true, key: true },
  });
  if (stage === null) {
    return { ok: false, message: 'That stage is not on your order.' };
  }
  if (title.trim().length < 4) {
    return { ok: false, message: 'Give the record a title somebody could look up.' };
  }

  await database().$transaction(async (transaction) => {
    const evidenceId = identifier('evd');
    await transaction.evidence.create({
      data: {
        id: evidenceId,
        contextKind: 'production',
        kind,
        title: title.trim(),
        productionStageId: stage.id,
        ...(detail === undefined || detail.trim() === ''
          ? {}
          : { payload: { detail: detail.trim() } }),
        submittedById: actorId,
        capturedAt: now,
      },
    });
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('evidence.captured'),
        actorRole: 'manufacturer',
        actorUserId: actorId,
        actorManufacturerId: manufacturerId,
        subjectKind: 'evidence',
        subjectId: evidenceId,
        orderId,
        payload: { kind, stage: stage.key },
        occurredAt: now,
      },
    });
  });

  return { ok: true };
};

/**
 * Records the shipment: the courier, the tracking reference and the date.
 *
 * It completes the shipped stage and writes a shipping record the buyer reads on
 * their own records screen — the same row, read from both sides. Delivery is a
 * separate act, and confirming it is the buyer's.
 */
export const recordShipment = async (
  manufacturerId: ManufacturerId,
  actorId: UserId,
  orderId: OrderId,
  courier: string,
  trackingReference: string,
  now: Date = new Date(),
): Promise<OrderOutcome> => {
  if (courier.trim() === '' || trackingReference.trim() === '') {
    return {
      ok: false,
      message: 'Say who is carrying it and what the tracking reference is.',
    };
  }

  const stage = await database().productionStage.findFirst({
    where: { orderId, key: 'shipped', order: { manufacturerId } },
    select: { id: true },
  });
  if (stage === null) return { ok: false, message: 'That order is not yours.' };

  const moved = await moveStage(
    manufacturerId,
    actorId,
    orderId,
    'shipped',
    'completed',
    `${courier.trim()} · ${trackingReference.trim()}`,
    now,
  );
  if (!moved.ok) return moved;

  await attachEvidence(
    manufacturerId,
    actorId,
    orderId,
    stage.id,
    'shipping_record',
    `Shipped with ${courier.trim()} · tracking ${trackingReference.trim()}`,
    undefined,
    now,
  );

  await database().domainEvent.create({
    data: {
      id: identifier('evt'),
      kind: toDatabaseEventKind('order.shipped'),
      actorRole: 'manufacturer',
      actorUserId: actorId,
      actorManufacturerId: manufacturerId,
      subjectKind: 'order',
      subjectId: orderId,
      orderId,
      payload: { courier: courier.trim(), trackingReference: trackingReference.trim() },
      occurredAt: now,
    },
  });

  return { ok: true };
};

/**
 * Records that the shipment arrived, which opens the buyer's review window.
 *
 * The manufacturer may say it arrived; only the buyer may confirm it. The
 * difference matters, because the confirmation is what releases the money — so
 * this writes the delivery date and the window, and nothing about the payout.
 */
export const recordDelivery = async (
  manufacturerId: ManufacturerId,
  actorId: UserId,
  orderId: OrderId,
  note: string | undefined,
  reviewWindowDays: number,
  now: Date = new Date(),
): Promise<OrderOutcome> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, manufacturerId },
    include: { stages: { where: { key: 'shipped' }, select: { status: true } } },
  });
  if (order === null) return { ok: false, message: 'That order is not yours.' };
  if (order.stages[0]?.status !== 'completed') {
    return { ok: false, message: 'Record the shipment first.' };
  }

  const moved = await moveStage(
    manufacturerId,
    actorId,
    orderId,
    'delivered',
    'completed',
    note,
    now,
  );
  if (!moved.ok) return moved;

  const endsAt = new Date(now.getTime() + reviewWindowDays * 86_400_000);

  await database().$transaction(async (transaction) => {
    await transaction.manufacturingOrder.update({
      where: { id: orderId },
      data: { deliveredAt: now, reviewWindowEndsAt: endsAt },
    });
    const stage = await transaction.productionStage.findFirstOrThrow({
      where: { orderId, key: 'delivered' },
      select: { id: true },
    });
    await transaction.evidence.create({
      data: {
        id: identifier('evd'),
        contextKind: 'production',
        kind: 'delivery_record',
        title:
          note === undefined || note.trim() === ''
            ? 'Delivered, awaiting the buyer’s confirmation'
            : `Delivered · ${note.trim()}`,
        productionStageId: stage.id,
        submittedById: actorId,
        capturedAt: now,
      },
    });
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('order.delivered'),
        actorRole: 'manufacturer',
        actorUserId: actorId,
        actorManufacturerId: manufacturerId,
        subjectKind: 'order',
        subjectId: orderId,
        orderId,
        payload: { reviewWindowEndsAt: endsAt.toISOString() },
        occurredAt: now,
      },
    });
  });

  return { ok: true };
};

export interface ShortageInput {
  readonly partReference: string;
  readonly partName: string;
  readonly shortfallQuantity: number;
  readonly note: string;
  readonly suggestedInventoryItemId?: string | undefined;
  readonly technicalJustification?: string | undefined;
  readonly priceImpactMinor?: number | undefined;
  readonly creditMinor?: number | undefined;
  readonly leadTimeImpactDays?: number | undefined;
  readonly restockLeadTimeDays?: number | undefined;
}

/**
 * Raises a shortage found after the terms were frozen.
 *
 * This is the one thing a shop may not solve on its own: the terms name the
 * parts, and changing them is the buyer's decision. So it is raised as an alert,
 * production stops until it is answered, and the three answers the buyer can give
 * are the buyer's screens to make.
 */
export const raiseShortage = async (
  manufacturerId: ManufacturerId,
  actorId: UserId,
  orderId: OrderId,
  input: ShortageInput,
  now: Date = new Date(),
): Promise<OrderOutcome> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, manufacturerId },
    include: { snapshot: true, payment: { select: { status: true } } },
  });
  if (order === null || order.snapshot === null) {
    return { ok: false, message: 'That order is not yours.' };
  }
  if (!isFundingSecured(order.payment?.status)) {
    return {
      ok: false,
      message: 'This order is not funded yet, so there is no production to hold up.',
    };
  }
  if (!Number.isInteger(input.shortfallQuantity) || input.shortfallQuantity <= 0) {
    return { ok: false, message: 'Say how many parts short you are.' };
  }
  if (input.note.trim().length < 10) {
    return {
      ok: false,
      message: 'Say what happened; the buyer has to decide on it and needs the reason.',
    };
  }

  const suggested =
    input.suggestedInventoryItemId === undefined
      ? null
      : await database().inventoryItem.findFirst({
          where: { id: input.suggestedInventoryItemId, manufacturerId },
          select: { id: true, partName: true },
        });

  const alertId = identifier('alert');

  await database().$transaction(async (transaction) => {
    await transaction.inventoryAlert.create({
      data: {
        id: alertId,
        orderId,
        raisedByManufacturerId: manufacturerId,
        partReference: input.partReference.trim(),
        partName: input.partName.trim(),
        shortfallQuantity: input.shortfallQuantity,
        note: input.note.trim(),
        ...(suggested === null
          ? {}
          : {
              suggestedInventoryItemId: suggested.id,
              suggestedPartName: suggested.partName,
            }),
        ...(input.technicalJustification === undefined ||
        input.technicalJustification.trim() === ''
          ? {}
          : { technicalJustification: input.technicalJustification.trim() }),
        currency: order.snapshot?.currency ?? 'USD',
        priceImpactMinor: BigInt(input.priceImpactMinor ?? 0),
        creditMinor: BigInt(input.creditMinor ?? 0),
        leadTimeImpactDays: input.leadTimeImpactDays ?? 0,
        ...(input.restockLeadTimeDays === undefined
          ? {}
          : { restockLeadTimeDays: input.restockLeadTimeDays }),
        status: 'open',
        raisedAt: now,
      },
    });
    await transaction.notification.create({
      data: {
        id: identifier('ntf'),
        recipientId: order.buyerId,
        kind: 'inventory_alert_raised',
        title: 'A part is short on your order',
        body: `${input.partName.trim()} — ${input.note.trim()}`,
        deepLink: `/manufacturing/orders/${orderId}`,
        createdAt: now,
      },
    });
  });

  return { ok: true };
};

/**
 * Asks IDEEZA to cancel a funded order.
 *
 * A manufacturer cannot cancel one itself: the buyer's money is held against it,
 * and letting the side holding the work decide would leave the buyer with neither
 * the goods nor the funds. So this raises the request, and operations decides.
 */
export const requestCancellation = async (
  manufacturerId: ManufacturerId,
  actorId: UserId,
  orderId: OrderId,
  reason: string,
  now: Date = new Date(),
): Promise<OrderOutcome> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, manufacturerId },
    include: { payment: { select: { status: true } } },
  });
  if (order === null) return { ok: false, message: 'That order is not yours.' };
  if (reason.trim().length < 10) {
    return { ok: false, message: 'Say why it cannot be built.' };
  }

  let next: OrderStatus;
  try {
    next = applyTransition(orderMachine, order.status, 'cancel_requested', {
      actorRole: 'manufacturer',
      paymentStatus: order.payment?.status,
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : `An order that is "${order.status}" cannot be cancelled.`,
    };
  }

  await database().$transaction(async (transaction) => {
    await transaction.manufacturingOrder.update({
      where: { id: orderId },
      data: { status: next },
    });
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('order.cancel_requested'),
        actorRole: 'manufacturer',
        actorUserId: actorId,
        actorManufacturerId: manufacturerId,
        subjectKind: 'order',
        subjectId: orderId,
        orderId,
        payload: { reason: reason.trim() },
        occurredAt: now,
      },
    });
    await transaction.notification.create({
      data: {
        id: identifier('ntf'),
        recipientId: order.buyerId,
        kind: 'order_cancel_requested',
        title: 'Your manufacturer has asked to cancel an order',
        body: reason.trim(),
        deepLink: `/manufacturing/orders/${orderId}`,
        createdAt: now,
      },
    });
  });

  return { ok: true };
};
