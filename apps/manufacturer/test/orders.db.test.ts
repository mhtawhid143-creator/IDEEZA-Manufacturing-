import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type ManufacturerId, type OrderId, type UserId } from '@ideeza/domain';
import type * as OrderData from '../src/data/orders.js';
import type * as BuyerProduction from '../../user/src/data/production.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

let database: TestDatabase;
let prisma: PrismaClient;
let orders: typeof OrderData;
let buyerProduction: typeof BuyerProduction;

const SHOP = asId<ManufacturerId>('seed_mfr_a');
const OTHER_SHOP = asId<ManufacturerId>('seed_mfr_b');
const MEMBER = asId<UserId>('seed_user_member_a');
const BUYER = asId<UserId>('seed_user_buyer');
const ORDER = asId<OrderId>('seed_order_1');

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  orders = await import('../src/data/orders.js');
  buyerProduction = await import('../../user/src/data/production.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('the orders a shop is building', () => {
  it('lists its own and nobody else’s, with where each one stands', async () => {
    const mine = await orders.listOrders(SHOP);
    expect(mine.rows.map((row) => row.orderId)).toContain(ORDER);
    expect(mine.rows.every((row) => row.totalStages > 0)).toBe(true);

    const theirs = await orders.listOrders(OTHER_SHOP);
    expect(theirs.rows.map((row) => row.orderId)).not.toContain(ORDER);

    expect(await orders.getOrder(OTHER_SHOP, ORDER)).toBeNull();
  });

  it('reads the terms from the immutable snapshot', async () => {
    const order = await orders.getOrder(SHOP, ORDER);
    const snapshot = await prisma.acceptedQuoteSnapshot.findUniqueOrThrow({
      where: { orderId: ORDER },
    });

    expect(order?.quantity).toBe(snapshot.quantity);
    expect(order?.unitPriceMinor).toBe(Number(snapshot.unitPriceMinor));
    expect(order?.totalPriceMinor).toBe(Number(snapshot.totalPriceMinor));
    expect(order?.materialProcessNotes).toBe(snapshot.materialProcessNotes);
    expect(order?.snapshotChecksum).toBe(snapshot.checksum);
  });

  it('counts the ones needing attention separately from the ones in flight', async () => {
    const counters = await orders.orderCounters(SHOP);
    const list = await orders.listOrders(SHOP, { pageSize: 1_000 });
    expect(counters.total).toBe(list.total);
    expect(counters.inFlight).toBeLessThanOrEqual(counters.total);
  });
});

describe('moving the production line', () => {
  it('refuses a stage the platform or the buyer owns', async () => {
    const system = await orders.moveStage(
      SHOP,
      MEMBER,
      ORDER,
      'completed',
      'completed',
      undefined,
    );
    expect(system.ok).toBe(false);
    if (!system.ok) expect(system.message).toMatch(/platform/);
  });

  it('refuses to skip an earlier stage', async () => {
    // The seeded order is in production, so shipping is two stages away.
    const skipped = await orders.moveStage(
      SHOP,
      MEMBER,
      ORDER,
      'shipped',
      'completed',
      undefined,
    );
    expect(skipped.ok).toBe(false);
    if (!skipped.ok) expect(skipped.message).toMatch(/not completed yet/);
  });

  it('refuses everything while a shortage is unanswered', async () => {
    const open = await prisma.inventoryAlert.count({
      where: { orderId: ORDER, status: 'open' },
    });
    expect(open).toBeGreaterThan(0);

    const held = await orders.moveStage(
      SHOP,
      MEMBER,
      ORDER,
      'in_production',
      'completed',
      undefined,
    );
    expect(held.ok).toBe(false);
    if (!held.ok) expect(held.message).toMatch(/waiting on the buyer/);
  });

  it('moves a stage once the shortage is answered, and the buyer sees it', async () => {
    // The buyer answers the shortage on their own screen; this is the row their
    // decision writes.
    await prisma.inventoryAlert.updateMany({
      where: { orderId: ORDER, status: 'open' },
      data: {
        status: 'substitute_approved',
        decidedAt: new Date(),
        decisionNote: 'Approved for this batch.',
      },
    });

    const moved = await orders.moveStage(
      SHOP,
      MEMBER,
      ORDER,
      'in_production',
      'completed',
      'Both batches assembled.',
    );
    expect(moved.ok).toBe(true);

    const mine = await orders.getOrder(SHOP, ORDER);
    const stage = mine?.stages.find((row) => row.key === 'in_production');
    expect(stage?.status).toBe('completed');
    expect(stage?.note).toBe('Both batches assembled.');

    // The buyer's production screen reads the same stage, at the same time.
    const theirs = await buyerProduction.getProduction(BUYER, ORDER);
    const theirStage = theirs?.stages.find((row) => row.key === 'in_production');
    expect(theirStage?.status).toBe('completed');
    expect(theirStage?.completedAt?.getTime()).toBe(stage?.completedAt?.getTime());

    // And the move is on the event log, with this shop as its author.
    const event = await prisma.domainEvent.findFirstOrThrow({
      where: { orderId: ORDER, kind: 'order_stage_advanced' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(event.actorRole).toBe('manufacturer');
    expect(event.actorManufacturerId).toBe(SHOP);
  });

  it('completes the tasks under a stage it completes', async () => {
    const stage = await prisma.productionStage.findFirstOrThrow({
      where: { orderId: ORDER, key: 'in_production' },
      include: { tasks: true },
    });
    expect(stage.tasks.length).toBeGreaterThan(0);
    expect(stage.tasks.every((task) => task.status === 'completed')).toBe(true);
  });

  it('starts a stage when the first task is ticked', async () => {
    const stage = await prisma.productionStage.findFirstOrThrow({
      where: { orderId: ORDER, key: 'quality_check' },
      include: { tasks: { orderBy: { position: 'asc' } } },
    });
    const task = stage.tasks[0];
    expect(task).toBeDefined();
    if (task === undefined) return;

    const ticked = await orders.setTaskStatus(SHOP, MEMBER, ORDER, task.id, 'completed');
    expect(ticked.ok).toBe(true);

    const after = await prisma.productionStage.findUniqueOrThrow({
      where: { id: stage.id },
    });
    expect(after.status).toBe('in_progress');
    expect(after.startedAt).not.toBeNull();
  });

  it('refuses a task on another shop’s order', async () => {
    const task = await prisma.productionTask.findFirstOrThrow({
      where: { orderId: ORDER },
    });
    const refused = await orders.setTaskStatus(
      OTHER_SHOP,
      MEMBER,
      ORDER,
      task.id,
      'completed',
    );
    expect(refused.ok).toBe(false);
  });
});

describe('records and shipping', () => {
  it('attaches a record to a stage, which the buyer reads on the order', async () => {
    const stage = await prisma.productionStage.findFirstOrThrow({
      where: { orderId: ORDER, key: 'quality_check' },
    });

    const attached = await orders.attachEvidence(
      SHOP,
      MEMBER,
      ORDER,
      stage.id,
      'quality_report',
      'AOI report, batch 1 of 2',
      'No defects on 250 boards.',
    );
    expect(attached.ok).toBe(true);

    const theirs = await buyerProduction.getProduction(BUYER, ORDER);
    expect(theirs?.evidence.map((record) => record.title)).toContain(
      'AOI report, batch 1 of 2',
    );

    const refused = await orders.attachEvidence(
      SHOP,
      MEMBER,
      ORDER,
      stage.id,
      'quality_report',
      'AOI',
      undefined,
    );
    expect(refused.ok).toBe(false);
  });

  it('records the shipment and the delivery, in that order', async () => {
    // Finish what is between production and shipping.
    for (const key of ['quality_check', 'ready_to_ship'] as const) {
      const moved = await orders.moveStage(SHOP, MEMBER, ORDER, key, 'completed', undefined);
      expect(moved.ok).toBe(true);
    }

    const tooEarly = await orders.recordDelivery(SHOP, MEMBER, ORDER, undefined, 7);
    expect(tooEarly.ok).toBe(false);

    const shipped = await orders.recordShipment(
      SHOP,
      MEMBER,
      ORDER,
      'DHL Express',
      '1Z999AA10123456784',
    );
    expect(shipped.ok).toBe(true);

    const theirs = await buyerProduction.getProduction(BUYER, ORDER);
    expect(theirs?.canTrackShipment).toBe(true);
    expect(
      theirs?.evidence.some((record) => record.title.includes('1Z999AA10123456784')),
    ).toBe(true);

    const delivered = await orders.recordDelivery(SHOP, MEMBER, ORDER, 'Signed by R. Khan', 7);
    expect(delivered.ok).toBe(true);

    const order = await prisma.manufacturingOrder.findUniqueOrThrow({
      where: { id: ORDER },
    });
    expect(order.status).toBe('delivered');
    expect(order.deliveredAt).not.toBeNull();
    expect(order.reviewWindowEndsAt).not.toBeNull();

    // Delivery does not release the money: that is the buyer's confirmation.
    const payout = await prisma.payout.findFirst({ where: { orderId: ORDER } });
    expect(payout === null || payout.status !== 'released').toBe(true);
  });
});

describe('raising a shortage', () => {
  it('holds production and tells the buyer', async () => {
    const before = await prisma.notification.count({ where: { recipientId: BUYER } });

    const raised = await orders.raiseShortage(SHOP, MEMBER, ORDER, {
      partReference: 'U3',
      partName: 'SiK telemetry radio 915MHz',
      shortfallQuantity: 120,
      note: 'Our supplier cancelled the allocation; nothing arrives for six weeks.',
      leadTimeImpactDays: 14,
    });
    expect(raised.ok).toBe(true);

    const alerts = await prisma.inventoryAlert.findMany({
      where: { orderId: ORDER, status: 'open' },
    });
    expect(alerts.length).toBe(1);

    // The buyer is told, and their own screen offers them the three answers.
    expect(await prisma.notification.count({ where: { recipientId: BUYER } })).toBe(
      before + 1,
    );
    const theirs = await buyerProduction.getProduction(BUYER, ORDER);
    expect(theirs?.openAlerts.length).toBe(1);
  });

  it('refuses one with no reason the buyer could decide on', async () => {
    const refused = await orders.raiseShortage(SHOP, MEMBER, ORDER, {
      partReference: 'U4',
      partName: 'Something',
      shortfallQuantity: 10,
      note: 'short',
    });
    expect(refused.ok).toBe(false);
  });
});

describe('asking to cancel', () => {
  it('raises the request rather than cancelling, and tells the buyer', async () => {
    // A second order to cancel, so the first keeps its history.
    const source = await prisma.manufacturingOrder.findUniqueOrThrow({
      where: { id: ORDER },
    });
    await prisma.manufacturingOrder.update({
      where: { id: ORDER },
      data: { status: 'in_production' },
    });

    const asked = await orders.requestCancellation(
      SHOP,
      MEMBER,
      ORDER,
      'The panel supplier has withdrawn the material and we cannot source it.',
    );
    expect(asked.ok).toBe(true);

    const after = await prisma.manufacturingOrder.findUniqueOrThrow({
      where: { id: ORDER },
    });
    // Requested, not cancelled: only operations may grant it.
    expect(after.status).toBe('cancel_requested');

    const event = await prisma.domainEvent.findFirstOrThrow({
      where: { orderId: ORDER, kind: 'order_cancel_requested' },
    });
    expect(event.actorRole).toBe('manufacturer');

    await prisma.manufacturingOrder.update({
      where: { id: ORDER },
      data: { status: source.status },
    });
  });

  it('refuses a cancellation with no reason', async () => {
    const refused = await orders.requestCancellation(SHOP, MEMBER, ORDER, 'no');
    expect(refused.ok).toBe(false);
  });
});
