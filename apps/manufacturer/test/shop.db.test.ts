import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type ManufacturerId, type UserId } from '@ideeza/domain';
import type * as DashboardData from '../src/data/dashboard.js';
import type * as ShopData from '../src/data/shop.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

let database: TestDatabase;
let prisma: PrismaClient;
let shop: typeof ShopData;
let dashboard: typeof DashboardData;

const SHOP = asId<ManufacturerId>('seed_mfr_a');
const OTHER_SHOP = asId<ManufacturerId>('seed_mfr_b');
const MEMBER = asId<UserId>('seed_user_member_a');

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  shop = await import('../src/data/shop.js');
  dashboard = await import('../src/data/dashboard.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('the shop a member is acting for', () => {
  it('reads the profile and what buyers match it on', async () => {
    const context = await shop.getShopContext(SHOP, MEMBER);

    expect(context?.displayName).toBe('PrecisionCircuit Co.');
    expect(context?.verified).toBe(true);
    expect(context?.services).toContain('assembly');
    expect(context?.servedRegions.length).toBeGreaterThan(0);
    expect(context?.minimumOrderQuantity).toBeGreaterThan(0);
  });

  it('scores completeness out of what a buyer is matched on', async () => {
    const context = await shop.getShopContext(SHOP, MEMBER);
    expect(context?.profileCompleteness).toBe(100);

    // A shop with nothing published is invisible to buyers, and says so.
    await prisma.manufacturerCapability.update({
      where: { manufacturerId: OTHER_SHOP },
      data: { services: [], servedRegions: [], certifications: [] },
    });
    const thin = await shop.getShopContext(OTHER_SHOP, MEMBER);
    expect(thin?.profileCompleteness).toBeLessThan(70);
  });

  it('is null for a shop that does not exist', async () => {
    expect(await shop.getShopContext(asId<ManufacturerId>('nope'), MEMBER)).toBeNull();
  });
});

describe('the dashboard headline numbers', () => {
  it('counts only this shop’s own work', async () => {
    const mine = await dashboard.getHeadlineTiles(SHOP);
    const theirs = await dashboard.getHeadlineTiles(OTHER_SHOP);

    // The seeded scenario: both shops were asked, one quote was accepted.
    expect(mine.quotesSubmitted + mine.quotesAccepted).toBeGreaterThan(0);
    expect(mine.quotesAccepted).toBe(1);
    expect(theirs.quotesAccepted).toBe(0);
  });

  it('sees the inventory that belongs to it, and nothing else', async () => {
    await prisma.inventoryItem.update({
      where: { manufacturerId_sku: { manufacturerId: SHOP, sku: 'MCU-STM32F405' } },
      data: { stockQuantity: 10, reservedQuantity: 10, lowStockThreshold: 50 },
    });

    const mine = await dashboard.getHeadlineTiles(SHOP);
    expect(mine.lowStockItems).toBeGreaterThan(0);
    expect(mine.criticalStockItems).toBeGreaterThan(0);

    const theirs = await dashboard.getHeadlineTiles(OTHER_SHOP);
    expect(theirs.criticalStockItems).toBe(0);
  });

  it('counts money that is waiting on a documented release', async () => {
    const mine = await dashboard.getHeadlineTiles(SHOP);
    const payout = await prisma.payout.findFirstOrThrow({
      where: { manufacturerId: SHOP, status: 'pending_release' },
    });

    expect(mine.pendingPayoutCount).toBe(1);
    expect(mine.pendingPayoutMinor).toBe(Number(payout.netAmountMinor));
  });

  it('calls an order late only once the quoted lead time has passed', async () => {
    const order = await prisma.manufacturingOrder.findFirstOrThrow({
      where: { manufacturerId: SHOP, status: 'in_production' },
      include: { snapshot: true },
    });
    const leadDays = order.snapshot?.leadTimeDays ?? 0;
    const confirmed = order.confirmedAt ?? new Date();

    const dayBefore = new Date(confirmed.getTime() + (leadDays - 1) * 86_400_000);
    const dayAfter = new Date(confirmed.getTime() + (leadDays + 1) * 86_400_000);

    expect((await dashboard.getHeadlineTiles(SHOP, dayBefore)).delayedOrders).toBe(0);
    expect((await dashboard.getHeadlineTiles(SHOP, dayAfter)).delayedOrders).toBe(1);
  });

  it('counts the requests still waiting for an answer', async () => {
    // The seeded request has been quoted by both shops, so nothing is open.
    const mine = await dashboard.getHeadlineTiles(SHOP);
    expect(mine.openRfqs).toBe(0);

    await prisma.rfqRecipient.update({
      where: {
        rfqId_manufacturerId: { rfqId: 'seed_rfq_1', manufacturerId: SHOP },
      },
      data: { status: 'routed', quotedAt: null },
    });
    await prisma.rfq.update({ where: { id: 'seed_rfq_1' }, data: { status: 'submitted' } });

    const after = await dashboard.getHeadlineTiles(SHOP);
    expect(after.openRfqs).toBe(1);
  });
});
