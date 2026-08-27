import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { InvariantViolationError, asId, type OrderId, type UserId } from '@ideeza/domain';
import type * as ProductionData from '../src/data/production.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

let database: TestDatabase;
let prisma: PrismaClient;
let production: typeof ProductionData;

const BUYER = asId<UserId>('seed_user_buyer');
const OTHER = asId<UserId>('seed_user_creator_a');
const ORDER = asId<OrderId>('seed_order_1');
const OPEN_ALERT = 'seed_alert_open';

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  production = await import('../src/data/production.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('reading how an order is being made', () => {
  it('shows all ten canonical stages, with the tasks inside them', async () => {
    const view = await production.getProduction(BUYER, ORDER);

    expect(view?.stages).toHaveLength(10);
    expect(view?.stages.map((stage) => stage.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(view?.currentStage?.key).toBe('in_production');
    expect(view?.completedStageCount).toBe(4);

    const live = view?.stages.find((stage) => stage.key === 'in_production');
    expect(live?.tasks.map((task) => task.label)).toContain('Assembly');
    expect(live?.tasks.some((task) => task.status === 'in_progress')).toBe(true);
  });

  it('derives the promised dates from the funding date and the courier', async () => {
    const view = await production.getProduction(BUYER, ORDER);
    const order = await prisma.manufacturingOrder.findUniqueOrThrow({
      where: { id: ORDER },
    });

    expect(view?.schedule?.confirmedAt.toISOString()).toBe(
      order.confirmedAt?.toISOString(),
    );
    expect(view?.schedule?.estimatedShipAt.getTime()).toBeGreaterThan(
      order.confirmedAt?.getTime() ?? 0,
    );
    expect(view?.schedule?.estimatedDeliveryAt.getTime()).toBeGreaterThan(
      view?.schedule?.estimatedShipAt.getTime() ?? 0,
    );
  });

  it('carries the record and the events the buyer may read', async () => {
    const view = await production.getProduction(BUYER, ORDER);
    expect(view?.evidence.map((record) => record.kind)).toContain('accepted_quote');
    expect(view?.activity.map((entry) => entry.kind)).toContain('order.confirmed');
    // Event kinds cross back as domain kinds, not database kinds.
    expect(view?.activity.every((entry) => !entry.kind.includes('_') || entry.kind.includes('.'))).toBe(true);
  });

  it('does not show another buyer the order', async () => {
    expect(await production.getProduction(OTHER, ORDER)).toBeNull();
  });

  it('prices the items from the accepted quote lines', async () => {
    const groups = await production.getOrderItems(BUYER, ORDER);
    expect(groups.length).toBeGreaterThan(0);
    const group = groups[0];
    expect(group?.items.length).toBeGreaterThan(0);
    expect(group?.grandTotalMinor).toBe(
      group?.items.reduce((total, item) => total + item.lineTotalMinor, 0),
    );
  });

  it('summarises the order from what was actually charged', async () => {
    const summary = await production.getOrderSummary(BUYER, ORDER);
    const payment = await prisma.payment.findFirstOrThrow({
      where: { id: 'seed_payment_1' },
    });

    expect(summary?.paidMinor).toBe(Number(payment.totalChargedMinor));
    expect(summary?.lines.some((line) => line.label.startsWith('Goods'))).toBe(true);
    expect(summary?.lines.some((line) => line.label === 'Platform fee')).toBe(true);
    // The substitute approved before production shows as its own line.
    expect(summary?.lines.some((line) => line.label === 'Substitute parts')).toBe(true);
    expect(summary?.adjustmentMinor).toBe(1_000);
  });
});

describe('answering a shortage', () => {
  it('lists the open one and the one already answered', async () => {
    const alerts = await production.listInventoryAlerts(BUYER, ORDER);
    expect(alerts).toHaveLength(2);
    expect(alerts.filter((alert) => alert.status === 'open')).toHaveLength(1);
  });

  it('refuses an answer from anyone but the buyer', async () => {
    await expect(
      production.answerInventoryAlert(OTHER, {
        alertId: OPEN_ALERT,
        resolution: 'drop_part',
        note: 'Ship without it.',
      }),
    ).rejects.toThrow(/does not exist/);
  });

  it('refuses to wait for stock when the manufacturer gave no restock date', async () => {
    await prisma.inventoryAlert.update({
      where: { id: OPEN_ALERT },
      data: { restockLeadTimeDays: null },
    });
    await expect(
      production.answerInventoryAlert(BUYER, {
        alertId: OPEN_ALERT,
        resolution: 'wait_for_stock',
      }),
    ).rejects.toThrow(InvariantViolationError);
    await prisma.inventoryAlert.update({
      where: { id: OPEN_ALERT },
      data: { restockLeadTimeDays: 26 },
    });
  });

  it('records the answer, the event and the evidence, and never edits the snapshot', async () => {
    const before = await prisma.acceptedQuoteSnapshot.findUniqueOrThrow({
      where: { orderId: ORDER },
    });

    const result = await production.answerInventoryAlert(BUYER, {
      alertId: OPEN_ALERT,
      resolution: 'approve_substitute',
      note: 'Approved, the tighter tolerance is welcome.',
    });

    expect(result.status).toBe('substitute_approved');
    expect(result.settlementMinor).toBe(9_000);
    expect(result.delayDays).toBe(2);

    const alert = await prisma.inventoryAlert.findUniqueOrThrow({
      where: { id: OPEN_ALERT },
    });
    expect(alert.status).toBe('substitute_approved');
    expect(alert.decidedAt).not.toBeNull();

    const events = await prisma.domainEvent.findMany({
      where: { subjectId: OPEN_ALERT },
    });
    expect(events.map((event) => event.kind)).toContain('substitution_approved');

    // A production record is bound to the stage it happened on, which is the
    // one context the database allows it to have.
    const evidence = await prisma.evidence.findMany({
      where: {
        kind: 'approved_substitution',
        OR: [{ orderId: ORDER }, { productionStage: { orderId: ORDER } }],
      },
      include: { productionStage: { select: { key: true } } },
    });
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence[0]?.productionStage?.key).toBe('in_production');

    const after = await prisma.acceptedQuoteSnapshot.findUniqueOrThrow({
      where: { orderId: ORDER },
    });
    expect(after.checksum).toBe(before.checksum);
    expect(after.totalPriceMinor).toBe(before.totalPriceMinor);
  });

  it('refuses a second answer to the same shortage', async () => {
    await expect(
      production.answerInventoryAlert(BUYER, {
        alertId: OPEN_ALERT,
        resolution: 'drop_part',
        note: 'Changed my mind.',
      }),
    ).rejects.toThrow(InvariantViolationError);
  });

  it('adds the approved impact to the order summary and to the dates', async () => {
    const summary = await production.getOrderSummary(BUYER, ORDER);
    expect(summary?.adjustmentMinor).toBe(10_000);

    const view = await production.getProduction(BUYER, ORDER);
    expect(view?.delayDays).toBe(2);
    expect(view?.openAlerts).toHaveLength(0);
  });

  it('lets production run once nothing is unanswered', async () => {
    await expect(production.assertProductionUnblocked(ORDER)).resolves.toBeUndefined();
  });
});
