import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type ManufacturerId, type RfqId, type UserId } from '@ideeza/domain';
import type * as InventoryData from '../src/data/inventory.js';
import type * as MatchData from '../src/data/inventory-match.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

let database: TestDatabase;
let prisma: PrismaClient;
let inventory: typeof InventoryData;
let match: typeof MatchData;

const SHOP = asId<ManufacturerId>('seed_mfr_a');
const OTHER_SHOP = asId<ManufacturerId>('seed_mfr_b');
const MEMBER = asId<UserId>('seed_user_member_a');

const part = {
  partName: 'Bulk capacitor 470uF 100V',
  sku: 'CAP-470U100V',
  category: 'Electrolytic capacitors',
  stockQuantity: 500,
  lowStockThreshold: 100,
  unitCostMinor: 210,
  currency: 'USD',
  leadTimeDays: 9,
  minimumOrderQuantity: 100,
  storageLocation: 'C3-08',
  enabledForMatching: true,
};

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  inventory = await import('../src/data/inventory.js');
  match = await import('../src/data/inventory-match.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('adding a part', () => {
  it('records its opening stock as a count', async () => {
    const result = await inventory.addPart(SHOP, MEMBER, part);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const detail = await inventory.getPart(SHOP, result.partId);
    expect(detail?.stockQuantity).toBe(500);
    expect(detail?.available).toBe(500);
    expect(detail?.level).toBe('in_stock');
    expect(detail?.movements.length).toBe(1);
    expect(detail?.movements[0]?.kind).toBe('stock_count');
    expect(detail?.movements[0]?.resultingStock).toBe(500);
    expect(detail?.movements[0]?.actorName).toBe('PrecisionCircuit Operator');
  });

  it('refuses a part that could not be quoted from', async () => {
    for (const broken of [
      { ...part, sku: 'CAP-2', unitCostMinor: 0 },
      { ...part, sku: 'CAP-3', leadTimeDays: 0 },
      { ...part, sku: 'not a sku!' },
      { ...part, sku: 'CAP-4', category: '  ' },
      { ...part, sku: 'CAP-5', stockQuantity: -1 },
    ]) {
      const result = await inventory.addPart(SHOP, MEMBER, broken);
      expect(result.ok).toBe(false);
    }
  });

  it('refuses a SKU this shop already holds', async () => {
    const again = await inventory.addPart(SHOP, MEMBER, part);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.message).toMatch(/already hold/);
  });

  it('lets another shop hold the same SKU', async () => {
    const elsewhere = await inventory.addPart(
      OTHER_SHOP,
      asId<UserId>('seed_user_member_b'),
      part,
    );
    expect(elsewhere.ok).toBe(true);
  });
});

describe('moving stock', () => {
  const skuId = async (): Promise<string> =>
    (
      await prisma.inventoryItem.findFirstOrThrow({
        where: { manufacturerId: SHOP, sku: part.sku },
      })
    ).id;

  it('adds what came in, and records what it left behind', async () => {
    const id = await skuId();
    const result = await inventory.updateStock(SHOP, MEMBER, id, {
      kind: 'stock_in',
      quantity: 250,
      note: 'Delivery 8841',
    });
    expect(result.ok).toBe(true);

    const detail = await inventory.getPart(SHOP, id);
    expect(detail?.stockQuantity).toBe(750);
    expect(detail?.movements[0]?.kind).toBe('stock_in');
    expect(detail?.movements[0]?.quantityDelta).toBe(250);
    expect(detail?.movements[0]?.note).toBe('Delivery 8841');
  });

  it('takes out only what is free to take', async () => {
    const id = await skuId();
    await prisma.inventoryItem.update({
      where: { id },
      data: { reservedQuantity: 700 },
    });

    const refused = await inventory.updateStock(SHOP, MEMBER, id, {
      kind: 'stock_out',
      quantity: 100,
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toMatch(/only 50 are free/);

    const allowed = await inventory.updateStock(SHOP, MEMBER, id, {
      kind: 'stock_out',
      quantity: 50,
    });
    expect(allowed.ok).toBe(true);

    const detail = await inventory.getPart(SHOP, id);
    expect(detail?.stockQuantity).toBe(700);
    expect(detail?.available).toBe(0);
    expect(detail?.level).toBe('out_of_stock');

    await prisma.inventoryItem.update({ where: { id }, data: { reservedQuantity: 0 } });
  });

  it('refuses a count that would leave an order unbuildable', async () => {
    const id = await skuId();
    await prisma.inventoryItem.update({ where: { id }, data: { reservedQuantity: 400 } });

    const refused = await inventory.updateStock(SHOP, MEMBER, id, {
      kind: 'stock_count',
      quantity: 300,
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toMatch(/reserved for orders/);

    await prisma.inventoryItem.update({ where: { id }, data: { reservedQuantity: 0 } });
  });

  it('takes a count as the total, and dates it', async () => {
    const id = await skuId();
    const result = await inventory.updateStock(SHOP, MEMBER, id, {
      kind: 'stock_count',
      quantity: 680,
      note: 'Quarterly count',
    });
    expect(result.ok).toBe(true);

    const detail = await inventory.getPart(SHOP, id);
    expect(detail?.stockQuantity).toBe(680);
    expect(detail?.lastCountedAt).not.toBeNull();
    expect(detail?.movements[0]?.quantityDelta).toBe(-20);
  });

  it('is history: a movement can never be edited', async () => {
    const id = await skuId();
    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { itemId: id },
    });

    // The database refuses it, not the application, so nothing can quietly
    // rewrite what a stock figure was.
    await expect(
      prisma.inventoryMovement.update({
        where: { id: movement.id },
        data: { quantityDelta: 9_999 },
      }),
    ).rejects.toThrow(/append_only_violation/);
  });
});

describe('changing the price', () => {
  it('keeps the old one on the record', async () => {
    const item = await prisma.inventoryItem.findFirstOrThrow({
      where: { manufacturerId: SHOP, sku: part.sku },
    });

    const result = await inventory.updatePrice(
      SHOP,
      MEMBER,
      item.id,
      240,
      new Date('2026-09-01T00:00:00.000Z'),
      'Supplier increase',
    );
    expect(result.ok).toBe(true);

    const detail = await inventory.getPart(SHOP, item.id);
    expect(detail?.unitCostMinor).toBe(240);
    expect(detail?.movements[0]?.kind).toBe('price_change');
    expect(detail?.movements[0]?.unitCostMinor).toBe(240);
    expect(detail?.movements[0]?.quantityDelta).toBe(0);

    // The history still holds what it cost before.
    const prices = detail?.movements
      .filter((movement) => movement.unitCostMinor !== null)
      .map((movement) => movement.unitCostMinor);
    expect(prices).toContain(210);
  });

  it('refuses a price that is not a price, or the one it already is', async () => {
    const item = await prisma.inventoryItem.findFirstOrThrow({
      where: { manufacturerId: SHOP, sku: part.sku },
    });
    expect((await inventory.updatePrice(SHOP, MEMBER, item.id, 0, null, undefined)).ok).toBe(
      false,
    );
    expect(
      (await inventory.updatePrice(SHOP, MEMBER, item.id, 240, null, undefined)).ok,
    ).toBe(false);
  });
});

describe('what a buyer’s request sees of this inventory', () => {
  it('stops counting a part switched off for matching', async () => {
    const item = await prisma.inventoryItem.findFirstOrThrow({
      where: { manufacturerId: SHOP, sku: 'MCU-STM32F405' },
    });

    // The reference request wants 500 of this part on each of 500 units, so the
    // shop is short of it — but it does hold some, which is the difference this
    // test is about.
    const before = await match.matchRequestAgainstInventory(
      SHOP,
      asId<RfqId>('seed_rfq_1'),
    );
    const line = before?.lines.find((candidate) => candidate.sku === 'MCU-STM32F405');
    expect(line?.coverage).toBe('short');
    expect(line?.held).not.toBeNull();

    await inventory.editPart(SHOP, item.id, { enabledForMatching: false });

    const after = await match.matchRequestAgainstInventory(
      SHOP,
      asId<RfqId>('seed_rfq_1'),
    );
    expect(after?.lines.find((line) => line.sku === 'MCU-STM32F405')?.coverage).toBe(
      'missing',
    );

    await inventory.editPart(SHOP, item.id, { enabledForMatching: true });
  });

  it('never shows one shop another shop’s parts', async () => {
    const mine = await inventory.listParts(SHOP);
    const theirs = await inventory.listParts(OTHER_SHOP);
    const overlap = mine.rows
      .map((row) => row.id)
      .filter((id) => theirs.rows.some((row) => row.id === id));
    expect(overlap).toEqual([]);

    const item = await prisma.inventoryItem.findFirstOrThrow({
      where: { manufacturerId: SHOP, sku: part.sku },
    });
    expect(await inventory.getPart(OTHER_SHOP, item.id)).toBeNull();
  });

  it('filters and counts by what is available, not what is on the shelf', async () => {
    const item = await prisma.inventoryItem.findFirstOrThrow({
      where: { manufacturerId: SHOP, sku: part.sku },
    });
    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { reservedQuantity: item.stockQuantity },
    });

    const out = await inventory.listParts(SHOP, { level: 'out_of_stock' });
    expect(out.rows.map((row) => row.sku)).toContain(part.sku);

    const counters = await inventory.inventoryCounters(SHOP);
    expect(counters.outOfStock).toBeGreaterThan(0);
    expect(counters.reservedParts).toBeGreaterThanOrEqual(item.stockQuantity);

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { reservedQuantity: 0 },
    });
  });
});

describe('reserving parts for an order', () => {
  it('reserves what it holds, reports what it cannot, and releases again', async () => {
    const order = await prisma.manufacturingOrder.findFirstOrThrow({
      where: { manufacturerId: SHOP },
    });

    const reservation = await inventory.reserveForOrder(SHOP, order.id, [
      { sku: part.sku, quantity: 200 },
      { sku: 'NOT-STOCKED', quantity: 10 },
    ]);
    expect(reservation.reserved).toEqual([{ sku: part.sku, quantity: 200 }]);
    expect(reservation.short.map((line) => line.sku)).toEqual(['NOT-STOCKED']);

    const item = await prisma.inventoryItem.findFirstOrThrow({
      where: { manufacturerId: SHOP, sku: part.sku },
    });
    expect(item.reservedQuantity).toBe(200);

    // Availability drops, which is what a buyer's coverage is judged on.
    const detail = await inventory.getPart(SHOP, item.id);
    expect(detail?.available).toBe(item.stockQuantity - 200);
    expect(detail?.movements[0]?.kind).toBe('reserved');
    expect(detail?.movements[0]?.orderId).toBe(order.id);

    // Consuming them releases the reservation and takes them off the shelf.
    const released = await inventory.releaseForOrder(SHOP, order.id, 'consumed');
    expect(released.released).toBe(200);

    const after = await prisma.inventoryItem.findFirstOrThrow({ where: { id: item.id } });
    expect(after.reservedQuantity).toBe(0);
    expect(after.stockQuantity).toBe(item.stockQuantity - 200);
  });

  it('releases without consuming when an order will not go ahead', async () => {
    const order = await prisma.manufacturingOrder.findFirstOrThrow({
      where: { manufacturerId: SHOP },
      orderBy: { createdAt: 'desc' },
    });
    const item = await prisma.inventoryItem.findFirstOrThrow({
      where: { manufacturerId: SHOP, sku: part.sku },
    });
    const before = item.stockQuantity;

    await inventory.reserveForOrder(SHOP, order.id, [{ sku: part.sku, quantity: 100 }]);
    await inventory.releaseForOrder(SHOP, order.id, 'cancelled');

    const after = await prisma.inventoryItem.findFirstOrThrow({ where: { id: item.id } });
    expect(after.reservedQuantity).toBe(0);
    expect(after.stockQuantity).toBe(before);
  });
});

describe('deleting a part', () => {
  it('refuses one with history, and allows one with none', async () => {
    const used = await prisma.inventoryItem.findFirstOrThrow({
      where: { manufacturerId: SHOP, sku: part.sku },
    });
    const refused = await inventory.deletePart(SHOP, used.id);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toMatch(/switch it off for matching/);

    const fresh = await inventory.addPart(SHOP, MEMBER, {
      ...part,
      sku: 'CAP-TEMP-1',
      partName: 'Temporary part',
    });
    expect(fresh.ok).toBe(true);
    if (!fresh.ok) return;

    const deleted = await inventory.deletePart(SHOP, fresh.partId);
    expect(deleted.ok).toBe(true);
    expect(await inventory.getPart(SHOP, fresh.partId)).toBeNull();
  });
});
