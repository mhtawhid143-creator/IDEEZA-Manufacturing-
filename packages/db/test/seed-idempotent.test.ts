import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../prisma/seed.js';
import { startTestDatabase, type TestDatabase } from '../test-support/index.js';

/**
 * The seed has to survive being run again.
 *
 * It never was, in practice — every test and every review environment ran it
 * once against an empty database. Then the hosted deployment started running it
 * on each deploy, and it failed on the first row whose upsert was keyed on `id`
 * while the table's real uniqueness was `(manufacturerId, kind)`: the row
 * existed under a different id, so the upsert tried to insert and collided.
 *
 * A seed that cannot run twice is a seed that can only ever prepare a fresh
 * database, which is not what a demo deployment needs. These run it twice.
 */

let database: TestDatabase;
let prisma: PrismaClient;

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  await seedDatabase(prisma);
});

afterAll(async () => {
  await database?.stop();
});

describe('running the seed a second time', () => {
  it('does not throw', async () => {
    await expect(seedDatabase(prisma)).resolves.not.toThrow();
  });

  it('leaves the same number of rows behind, not twice as many', async () => {
    const before = {
      users: await prisma.user.count(),
      rfqs: await prisma.rfq.count(),
      quotes: await prisma.quote.count(),
      orders: await prisma.manufacturingOrder.count(),
      sheets: await prisma.shopCapabilitySheet.count(),
      parts: await prisma.inventoryItem.count(),
      costLines: await prisma.quoteCostLine.count(),
      withdrawals: await prisma.withdrawalRequest.count(),
    };

    await seedDatabase(prisma);

    expect({
      users: await prisma.user.count(),
      rfqs: await prisma.rfq.count(),
      quotes: await prisma.quote.count(),
      orders: await prisma.manufacturingOrder.count(),
      sheets: await prisma.shopCapabilitySheet.count(),
      parts: await prisma.inventoryItem.count(),
      costLines: await prisma.quoteCostLine.count(),
      withdrawals: await prisma.withdrawalRequest.count(),
    }).toEqual(before);
  });

  it('converges on a sheet an older seed wrote under a different id', async () => {
    // This is the hosted failure, reproduced. The database had been prepared
    // weeks earlier, the capability sheet ids had changed since, and the row
    // existed for the same `(manufacturerId, kind)` under the old id — so an
    // upsert keyed on `id` tried to insert and hit the unique constraint.
    const sheet = await prisma.shopCapabilitySheet.findFirstOrThrow();
    await prisma.shopCapabilitySheet.update({
      where: { id: sheet.id },
      data: { id: `legacy_${sheet.id}` },
    });

    await expect(seedDatabase(prisma)).resolves.not.toThrow();

    const after = await prisma.shopCapabilitySheet.findMany({
      where: { manufacturerId: sheet.manufacturerId, kind: sheet.kind },
    });
    expect(after).toHaveLength(1);
    expect(after[0]?.id).toBe(sheet.id);
  });

  it('keeps one capability sheet per shop and kind, which is what broke', async () => {
    const sheets = await prisma.shopCapabilitySheet.findMany({
      select: { manufacturerId: true, kind: true },
    });
    const keys = sheets.map((row) => `${row.manufacturerId}:${row.kind}`);

    expect(new Set(keys).size).toBe(keys.length);
  });
});
