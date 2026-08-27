import {
  assertAlertIsOpen,
  assertNoOpenAlerts,
  assertOrderCanAnswerAlerts,
  assertResolutionIsAvailable,
  asId,
  CANONICAL_STAGES,
  orderSchedule,
  RESOLUTION_STATUS,
  resolutionDelayDays,
  resolutionSettlementMinor,
  stageDefinition,
  type InventoryResolution,
  type OrderId,
  type OrderSchedule,
  type OrderStatus,
  type ProductionProgressStatus,
  type ProductionStageKey,
  type ShippingChoice,
  type UserId,
} from '@ideeza/domain';
import { toDatabaseEventKind, toDomainEventKind } from '@ideeza/db';
import type { AnswerInventoryAlertInput } from '@ideeza/types';
import { database } from '@/lib/db.js';

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface ProductionTaskView {
  readonly id: string;
  readonly label: string;
  readonly status: ProductionProgressStatus;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
}

export interface ProductionStageView {
  readonly id: string;
  readonly key: ProductionStageKey;
  readonly position: number;
  readonly label: string;
  readonly status: ProductionProgressStatus;
  readonly advancedBy: 'system' | 'manufacturer' | 'buyer';
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly note: string | null;
  readonly tasks: readonly ProductionTaskView[];
  readonly evidenceCount: number;
}

export interface ActivityEntry {
  readonly id: string;
  readonly kind: string;
  readonly actorRole: string;
  readonly occurredAt: Date;
  readonly detail: string | null;
}

export interface EvidenceView {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly contextKind: string;
  readonly stageKey: ProductionStageKey | null;
  readonly fileName: string | null;
  readonly capturedAt: Date;
}

export type InventoryAlertStatusValue =
  | 'open'
  | 'substitute_approved'
  | 'part_dropped'
  | 'stock_awaited';

export interface InventoryAlertView {
  readonly id: string;
  readonly orderId: OrderId;
  readonly partReference: string;
  readonly partName: string;
  readonly shortfallQuantity: number;
  readonly note: string;
  readonly suggestedPartName: string | null;
  readonly technicalJustification: string | null;
  readonly currency: string;
  readonly priceImpactMinor: number;
  readonly creditMinor: number;
  readonly leadTimeImpactDays: number;
  readonly restockLeadTimeDays: number | null;
  readonly status: InventoryAlertStatusValue;
  readonly decidedAt: Date | null;
  readonly decisionNote: string | null;
  readonly raisedAt: Date;
  readonly raisedByName: string;
}

export interface OrderLineView {
  readonly label: string;
  readonly amountMinor: number;
  readonly note?: string | undefined;
}

export interface OrderItemView {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly lineTotalMinor: number;
  readonly reference: string | null;
  readonly manufacturerPartNumber: string | null;
  readonly sku: string | null;
}

export interface OrderItemGroupView {
  readonly id: string;
  readonly title: string;
  readonly items: readonly OrderItemView[];
  readonly grandTotalMinor: number;
}

export interface ProductionView {
  readonly orderId: OrderId;
  readonly status: OrderStatus;
  readonly currency: string;
  readonly quantity: number;
  readonly leadTimeDays: number;
  readonly shippingChoice: ShippingChoice;
  readonly schedule: OrderSchedule | null;
  readonly delayDays: number;
  readonly stages: readonly ProductionStageView[];
  readonly currentStage: ProductionStageView | null;
  readonly completedStageCount: number;
  readonly activity: readonly ActivityEntry[];
  readonly evidence: readonly EvidenceView[];
  readonly alerts: readonly InventoryAlertView[];
  readonly openAlerts: readonly InventoryAlertView[];
  readonly canTrackShipment: boolean;
}

/** Plain English for the events the buyer is allowed to read. */
const EVENT_DETAIL: Readonly<Record<string, string>> = {
  'rfq.submitted': 'The request went out to the manufacturers.',
  'quote.submitted': 'A quote came back.',
  'quote.accepted': 'You accepted a quote, which opened this order.',
  'substitution.suggested': 'A replacement part was suggested.',
  'substitution.approved': 'A replacement part was approved.',
  'substitution.rejected': 'A replacement part was refused.',
  'payment.initiated': 'Payment started.',
  'payment.secured': 'IDEEZA took the funds and is holding them.',
  'payment.failed': 'A payment attempt failed.',
  'order.created': 'The order was opened against the accepted terms.',
  'order.confirmed': 'The order was confirmed, so production could start.',
  'order.production_started': 'The manufacturer started work.',
  'order.stage_advanced': 'A production stage moved forward.',
  'order.task_updated': 'A shop-floor task changed.',
  'order.shipped': 'The units left the factory.',
  'order.delivered': 'The courier recorded delivery.',
  'order.delivery_confirmed': 'You confirmed delivery.',
  'order.completed': 'The order closed.',
};

interface AlertRow {
  readonly id: string;
  readonly orderId: string;
  readonly partReference: string;
  readonly partName: string;
  readonly shortfallQuantity: number;
  readonly note: string;
  readonly suggestedPartName: string | null;
  readonly technicalJustification: string | null;
  readonly currency: string;
  readonly priceImpactMinor: bigint;
  readonly creditMinor: bigint;
  readonly leadTimeImpactDays: number;
  readonly restockLeadTimeDays: number | null;
  readonly status: InventoryAlertStatusValue;
  readonly decidedAt: Date | null;
  readonly decisionNote: string | null;
  readonly raisedAt: Date;
  readonly raisedBy: { readonly displayName: string };
}

const alertView = (row: AlertRow): InventoryAlertView => ({
  id: row.id,
  orderId: asId<OrderId>(row.orderId),
  partReference: row.partReference,
  partName: row.partName,
  shortfallQuantity: row.shortfallQuantity,
  note: row.note,
  suggestedPartName: row.suggestedPartName,
  technicalJustification: row.technicalJustification,
  currency: row.currency,
  priceImpactMinor: Number(row.priceImpactMinor),
  creditMinor: Number(row.creditMinor),
  leadTimeImpactDays: row.leadTimeImpactDays,
  restockLeadTimeDays: row.restockLeadTimeDays,
  status: row.status,
  decidedAt: row.decidedAt,
  decisionNote: row.decisionNote,
  raisedAt: row.raisedAt,
  raisedByName: row.raisedBy.displayName,
});

/** How many days a decided shortage added to the promised dates. */
const alertDelayDays = (alert: InventoryAlertView): number => {
  if (alert.status === 'substitute_approved') return alert.leadTimeImpactDays;
  if (alert.status === 'stock_awaited') return alert.restockLeadTimeDays ?? 0;
  return 0;
};

/**
 * Everything the buyer may read about how the order is being made.
 *
 * The ten canonical stages are the buyer's view of production, and the tasks
 * inside a stage are the manufacturer's own detail, shown read-only. Dates are
 * derived from the moment the funds were secured, and any delay the buyer
 * accepted along with a replacement part is added to them rather than quietly
 * dropped.
 */
export const getProduction = async (
  buyerId: UserId,
  orderId: OrderId,
): Promise<ProductionView | null> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, buyerId },
    include: {
      snapshot: true,
      stages: {
        orderBy: { position: 'asc' },
        include: {
          tasks: { orderBy: { position: 'asc' } },
          evidence: { select: { id: true } },
        },
      },
      alerts: {
        orderBy: { raisedAt: 'desc' },
        include: { raisedBy: { select: { displayName: true } } },
      },
      domainEvents: { orderBy: { occurredAt: 'asc' } },
    },
  });
  if (order === null || order.snapshot === null) return null;

  // Evidence is bound to exactly one context: some rows hang off the order, some
  // off a stage of it. Both belong to this order's record, so both are read.
  const evidence = await database().evidence.findMany({
    where: {
      OR: [{ orderId: order.id }, { productionStage: { orderId: order.id } }],
    },
    orderBy: { capturedAt: 'desc' },
    include: {
      file: { select: { name: true } },
      productionStage: { select: { key: true } },
    },
  });

  const stages: readonly ProductionStageView[] = order.stages.map((stage) => {
    const definition = stageDefinition(stage.key);
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
    };
  });

  const alerts = order.alerts.map((row) => alertView(row));
  const delayDays = alerts.reduce((total, alert) => total + alertDelayDays(alert), 0);

  const current =
    stages.find((stage) => stage.status === 'in_progress') ??
    stages.find((stage) => stage.status === 'pending') ??
    null;

  const shipped = stages.find((stage) => stage.key === 'shipped');

  return {
    orderId: asId<OrderId>(order.id),
    status: order.status,
    currency: order.snapshot.currency,
    quantity: order.snapshot.quantity,
    leadTimeDays: order.snapshot.leadTimeDays,
    shippingChoice: order.shippingChoice,
    schedule:
      order.confirmedAt === null
        ? null
        : orderSchedule({
            confirmedAt: order.confirmedAt,
            leadTimeDays: order.snapshot.leadTimeDays,
            shippingChoice: order.shippingChoice,
            extraLeadTimeDays: delayDays,
          }),
    delayDays,
    stages,
    currentStage: current,
    completedStageCount: stages.filter((stage) => stage.status === 'completed').length,
    activity: order.domainEvents.map((event) => {
      const kind = toDomainEventKind(event.kind);
      return {
        id: event.id,
        kind,
        actorRole: event.actorRole,
        occurredAt: event.occurredAt,
        detail: EVENT_DETAIL[kind] ?? null,
      };
    }),
    evidence: evidence.map((record) => ({
      id: record.id,
      kind: record.kind,
      title: record.title,
      contextKind: record.contextKind,
      stageKey: record.productionStage?.key ?? null,
      fileName: record.file?.name ?? null,
      capturedAt: record.capturedAt,
    })),
    alerts,
    openAlerts: alerts.filter((alert) => alert.status === 'open'),
    canTrackShipment: shipped?.status === 'completed',
  };
};

const PACKAGE_TITLE: Readonly<Record<string, string>> = {
  pcb: 'PCB items',
  module_3d: '3D module',
  full_product: 'Full product (boards and printed parts)',
};

/**
 * What the order is made of, as the manufacturer priced it.
 *
 * The accepted quote's own lines are the source: they are what was costed and
 * what the buyer accepted. The design groups the items by kind of work, and the
 * kind lives on the package, so that is what the grouping follows — nothing in
 * the domain classifies an individual quote line as a board or a printed part.
 */
export const getOrderItems = async (
  buyerId: UserId,
  orderId: OrderId,
): Promise<readonly OrderItemGroupView[]> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, buyerId },
    include: {
      snapshot: true,
      rfq: { select: { package: { select: { kind: true } } } },
      acceptedQuote: { include: { items: { include: { rfqItem: true } } } },
    },
  });
  if (order === null || order.snapshot === null) return [];

  const title = PACKAGE_TITLE[order.rfq.package.kind] ?? order.rfq.package.kind;
  const lines = order.acceptedQuote.items;

  if (lines.length === 0) {
    // A quote may price the lot rather than the lines. The order still has to
    // show what was bought, so the frozen snapshot is the single line.
    return [
      {
        id: 'lot',
        title,
        items: [
          {
            id: 'lot',
            name: order.snapshot.materialProcessNotes,
            detail: `Quoted as one lot · ${order.snapshot.leadTimeDays} days`,
            quantity: order.snapshot.quantity,
            unitPriceMinor: Number(order.snapshot.unitPriceMinor),
            lineTotalMinor: Number(order.snapshot.totalPriceMinor),
            reference: null,
            manufacturerPartNumber: null,
            sku: null,
          },
        ],
        grandTotalMinor: Number(order.snapshot.totalPriceMinor),
      },
    ];
  }

  const items: readonly OrderItemView[] = lines.map((line) => ({
    id: line.id,
    name: line.description,
    detail:
      line.rfqItem === null
        ? `${line.quantity} units`
        : `${line.rfqItem.reference} · ${line.rfqItem.componentName}`,
    quantity: line.quantity,
    unitPriceMinor: Number(line.unitPriceMinor),
    lineTotalMinor: Number(line.lineTotalMinor),
    reference: line.rfqItem?.reference ?? null,
    manufacturerPartNumber: line.rfqItem?.manufacturerPartNumber ?? null,
    sku: line.rfqItem?.sku ?? null,
  }));

  return [
    {
      id: order.rfq.package.kind,
      title,
      items,
      grandTotalMinor: items.reduce((total, item) => total + item.lineTotalMinor, 0),
    },
  ];
};

export interface OrderSummaryView {
  readonly currency: string;
  readonly lines: readonly OrderLineView[];
  readonly paidMinor: number;
  readonly adjustmentMinor: number;
}

/**
 * The order summary, as it stands.
 *
 * The lines come from what was actually charged rather than from a fresh sum:
 * the payment row is the record of what the buyer agreed to. Answers to
 * shortages are added underneath as their own lines, because the frozen
 * snapshot may never be edited — so a change made during production is visible
 * as a change, and what it leaves owing is stated instead of being folded away.
 */
export const getOrderSummary = async (
  buyerId: UserId,
  orderId: OrderId,
): Promise<OrderSummaryView | null> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, buyerId },
    include: { snapshot: true, payment: true, alerts: true },
  });
  if (order === null || order.snapshot === null) return null;

  const goodsMinor = Number(order.snapshot.totalPriceMinor);
  const toolingMinor = Number(order.snapshot.toolingSetupCostMinor ?? 0n);
  const payment = order.payment;

  const lines: OrderLineView[] = [
    {
      label: `Goods (${order.snapshot.quantity} pcs)`,
      amountMinor: goodsMinor,
      note: 'As quoted',
    },
  ];
  if (toolingMinor > 0) {
    lines.push({ label: 'Tooling / setup', amountMinor: toolingMinor });
  }

  let adjustmentMinor = 0;
  const approved = order.alerts.filter((alert) => alert.status === 'substitute_approved');
  const dropped = order.alerts.filter((alert) => alert.status === 'part_dropped');

  if (approved.length > 0) {
    const amount = approved.reduce(
      (total, alert) => total + Number(alert.priceImpactMinor),
      0,
    );
    adjustmentMinor += amount;
    lines.push({
      label: 'Substitute parts',
      amountMinor: amount,
      note: `${approved.length} approved during production`,
    });
  }
  if (dropped.length > 0) {
    const amount = dropped.reduce((total, alert) => total + Number(alert.creditMinor), 0);
    adjustmentMinor -= amount;
    lines.push({
      label: 'Parts not supplied (credit)',
      amountMinor: -amount,
      note: `${dropped.length} dropped during production`,
    });
  }

  if (payment !== null) {
    const shippingMinor = Number(payment.shippingAmountMinor);
    const quotedShipping = Number(order.snapshot.shippingEstimateMinor ?? 0n);
    lines.push({
      label: order.shippingChoice === 'express' ? 'Shipping (expedited)' : 'Shipping',
      amountMinor: shippingMinor,
      ...(shippingMinor > quotedShipping
        ? { note: 'Expedited, on top of the quoted rate' }
        : {}),
    });
    if (Number(payment.taxAmountMinor) > 0) {
      lines.push({ label: 'Tax', amountMinor: Number(payment.taxAmountMinor) });
    }
    lines.push({ label: 'Platform fee', amountMinor: Number(payment.platformFeeMinor) });
    if (Number(payment.discountAmountMinor) > 0) {
      lines.push({
        label: 'Discount',
        amountMinor: -Number(payment.discountAmountMinor),
      });
    }
  }

  return {
    currency: order.snapshot.currency,
    lines,
    paidMinor: payment === null ? 0 : Number(payment.totalChargedMinor),
    adjustmentMinor,
  };
};

export const listInventoryAlerts = async (
  buyerId: UserId,
  orderId: OrderId,
): Promise<readonly InventoryAlertView[]> => {
  const rows = await database().inventoryAlert.findMany({
    where: { orderId, order: { buyerId } },
    orderBy: [{ status: 'asc' }, { raisedAt: 'desc' }],
    include: { raisedBy: { select: { displayName: true } } },
  });
  return rows.map((row) => alertView(row));
};

export interface AnswerResult {
  readonly alertId: string;
  readonly status: InventoryAlertStatusValue;
  readonly settlementMinor: number;
  readonly delayDays: number;
}

/**
 * The buyer answers a shortage.
 *
 * Approving the replacement, dropping the part or waiting for stock are the
 * three things that can honestly happen. Each is recorded as a decision on the
 * alert, as an event on the order and as a piece of the documented record — and
 * none of them edits the frozen snapshot.
 */
export const answerInventoryAlert = async (
  buyerId: UserId,
  input: AnswerInventoryAlertInput,
  now: Date = new Date(),
): Promise<AnswerResult> => {
  const alert = await database().inventoryAlert.findFirst({
    where: { id: input.alertId, order: { buyerId } },
    include: {
      order: {
        select: {
          id: true,
          status: true,
          stages: { orderBy: { position: 'asc' }, select: { id: true, key: true, status: true } },
        },
      },
    },
  });
  if (alert === null) throw new Error('That shortage does not exist.');

  assertOrderCanAnswerAlerts(alert.order.status);
  assertAlertIsOpen(alert.id, alert.status);

  const facts = {
    status: alert.status,
    suggestedPartName: alert.suggestedPartName,
    priceImpactMinor: Number(alert.priceImpactMinor),
    creditMinor: Number(alert.creditMinor),
    leadTimeImpactDays: alert.leadTimeImpactDays,
    restockLeadTimeDays: alert.restockLeadTimeDays,
  };
  const resolution: InventoryResolution = input.resolution;
  assertResolutionIsAvailable(resolution, facts);

  const settlementMinor = resolutionSettlementMinor(resolution, facts);
  const delayDays = resolutionDelayDays(resolution, facts);
  const status = RESOLUTION_STATUS[resolution];

  await database().$transaction(async (transaction) => {
    await transaction.inventoryAlert.update({
      where: { id: alert.id },
      data: { status, decidedAt: now, decisionNote: input.note ?? null },
    });

    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind(
          resolution === 'approve_substitute'
            ? 'substitution.approved'
            : 'substitution.rejected',
        ),
        actorRole: 'buyer',
        actorUserId: buyerId,
        subjectKind: 'substitution',
        subjectId: alert.id,
        orderId: alert.order.id,
        payload: {
          resolution,
          partReference: alert.partReference,
          settlementMinor,
          delayDays,
          currency: alert.currency,
        },
        occurredAt: now,
      },
    });

    // The decision belongs to the record a dispute would be decided on, and a
    // production record is bound to the stage it happened on: the stage that is
    // live, or the one where parts are confirmed if work has not started yet.
    const stage =
      alert.order.stages.find((row) => row.status === 'in_progress') ??
      alert.order.stages.find((row) => row.key === 'materials_confirmed') ??
      alert.order.stages[0];

    await transaction.evidence.create({
      data: {
        id: identifier('ev'),
        contextKind: stage === undefined ? 'order' : 'production',
        kind:
          resolution === 'approve_substitute' ? 'approved_substitution' : 'change_order',
        title: `${alert.partReference} — ${resolution.replace(/_/g, ' ')}`,
        ...(stage === undefined
          ? { orderId: alert.order.id }
          : { productionStageId: stage.id }),
        submittedById: buyerId,
        payload: {
          resolution,
          partName: alert.partName,
          suggestedPartName: alert.suggestedPartName,
          settlementMinor,
          delayDays,
          note: input.note ?? null,
        },
        capturedAt: now,
      },
    });
  });

  return { alertId: alert.id, status, settlementMinor, delayDays };
};

/** Production may not move while a shortage is unanswered. */
export const assertProductionUnblocked = async (orderId: OrderId): Promise<void> => {
  const openCount = await database().inventoryAlert.count({
    where: { orderId, status: 'open' },
  });
  assertNoOpenAlerts(openCount);
};

/** The canonical stage list, including stages an order has not reached. */
export const stageOutline = (): readonly { readonly key: string; readonly label: string }[] =>
  CANONICAL_STAGES.map((stage) => ({ key: stage.key, label: stage.label }));
