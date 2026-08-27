import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type ManufacturerId, type RfqId, type UserId } from '@ideeza/domain';
import type * as ManufacturerRfqs from '../src/data/rfqs.js';
import type * as BuyerRequests from '../../user/src/data/requests.js';
import type * as BuyerBoardSpec from '../../user/src/data/board-spec.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

/**
 * The two panels read one document.
 *
 * This is the test the whole alignment rests on: the buyer writes the production
 * boundary, the manufacturer prices it, and if the two screens word the same
 * frozen requirement differently then a dispute turns on which screen someone
 * was looking at. So both data layers are called against one database, for one
 * request, and their rows are compared exactly.
 *
 * Both apps are imported here. Their `@/lib/db.js` modules are byte-identical
 * wrappers around the shared client, so whichever one the alias resolves to is
 * the same client either way.
 */
let database: TestDatabase;
let prisma: PrismaClient;
let shopSide: typeof ManufacturerRfqs;
let buyerSide: typeof BuyerRequests;
let buyerBoard: typeof BuyerBoardSpec;

const SHOP = asId<ManufacturerId>('seed_mfr_a');
const BUYER = asId<UserId>('seed_user_buyer');
const RFQ = asId<RfqId>('seed_rfq_1');

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  shopSide = await import('../src/data/rfqs.js');
  buyerSide = await import('../../user/src/data/requests.js');
  buyerBoard = await import('../../user/src/data/board-spec.js');

  // The reference request is closed, and a closed request is still readable on
  // both sides — which is the point: the record does not change afterwards.
  await prisma.rfq.update({ where: { id: RFQ }, data: { status: 'submitted' } });
});

afterAll(async () => {
  await database?.stop();
});

describe('one request, two panels', () => {
  it('reads the same production requirement, row for row', async () => {
    const [buyerView, shopView] = await Promise.all([
      buyerSide.getRequest(BUYER, RFQ),
      shopSide.getRoutedRequest(SHOP, RFQ),
    ]);

    expect(buyerView).not.toBeNull();
    expect(shopView).not.toBeNull();
    expect(shopView?.requirementRows).toEqual(buyerView?.requirementRows);

    // And not vacuously: the rows say something, in words rather than tokens.
    const rows = shopView?.requirementRows ?? [];
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.some((row) => row.label === 'Substitutions')).toBe(true);
    expect(rows.every((row) => !/^[a-z_]+$/.test(row.value))).toBe(true);
  });

  it('reads the same board specification, row for row', async () => {
    const [buyerSpec, shopView] = await Promise.all([
      buyerBoard.getBoardSpec(BUYER, RFQ),
      shopSide.getRoutedRequest(SHOP, RFQ),
    ]);

    expect(buyerSpec).not.toBeNull();
    expect(buyerSpec?.hasBoard).toBe(true);
    expect(shopView?.boardSpecRows).toEqual(buyerBoard.boardSpecRows(buyerSpec!));
  });

  it('agrees on the quantity, the volumes and the target price', async () => {
    const buyerView = await buyerSide.getRequest(BUYER, RFQ);
    const shopView = await shopSide.getRoutedRequest(SHOP, RFQ);

    expect(shopView?.quantity).toBe(buyerView?.quantity);
    expect(shopView?.volumeTiers).toEqual(buyerView?.volumeTiers);
    expect(shopView?.currency).toBe(buyerView?.currency);
    expect(
      shopView?.targetPriceMinor === null ? null : BigInt(shopView?.targetPriceMinor ?? 0),
    ).toEqual(buyerView?.targetPriceMinor);
    expect(shopView?.serviceLabels.length).toBe(buyerView?.requestedServices.length);
  });

  it('agrees on the bill of materials, line for line', async () => {
    const shopView = await shopSide.getRoutedRequest(SHOP, RFQ);
    const lines = await prisma.rfqItem.findMany({
      where: { rfqId: RFQ },
      orderBy: { reference: 'asc' },
    });

    expect(shopView?.bomLines.map((line) => line.reference)).toEqual(
      lines.map((line) => line.reference),
    );
    expect(shopView?.bomLines.map((line) => line.quantityRequired)).toEqual(
      lines.map((line) => line.quantityRequired),
    );
  });

  it('agrees on where it is going and by when', async () => {
    const buyerView = await buyerSide.getRequest(BUYER, RFQ);
    const shopView = await shopSide.getRoutedRequest(SHOP, RFQ);

    expect(shopView?.shipTo.city).toBe(buyerView?.deliveryAddress.city);
    expect(shopView?.shipTo.countryCode).toBe(buyerView?.deliveryAddress.countryCode);
    expect(shopView?.neededBy?.getTime()).toBe(buyerView?.neededBy?.getTime());
  });

  it('shows the buyer the decline reason the shop chose, in the same words', async () => {
    // A second request, so the reference one keeps its quotes.
    await prisma.rfq.create({
      data: {
        id: 'align_rfq_declined',
        buyerId: BUYER,
        packageId: 'seed_package_full',
        requirementsId: 'seed_requirements_v1',
        status: 'submitted',
        quantity: 50,
        requestedServices: [],
        volumeTiers: [],
        currency: 'USD',
        shipToLine1: '20/3, Sector 9',
        shipToCity: 'Dhaka',
        shipToCountryCode: 'BD',
        submittedAt: new Date(),
        recipients: {
          create: [{ id: 'align_recipient_a', manufacturerId: SHOP, status: 'routed' }],
        },
      },
    });

    const declined = await shopSide.declineRequest(
      SHOP,
      asId<RfqId>('align_rfq_declined'),
      { reason: 'below_minimum_order_quantity' },
    );
    expect(declined.ok).toBe(true);

    const shopView = await shopSide.getRoutedRequest(
      SHOP,
      asId<RfqId>('align_rfq_declined'),
    );
    const buyerView = await buyerSide.getRequest(BUYER, asId<RfqId>('align_rfq_declined'));
    const recipient = buyerView?.recipients.find(
      (candidate) => candidate.manufacturerId === SHOP,
    );

    expect(recipient?.status).toBe('declined');
    expect(recipient?.declineReason).toBe('below_minimum_order_quantity');
    expect(shopView?.declineReasonLabel).toBe(
      'Below this shop’s minimum order quantity',
    );
  });
});

describe('what the buyer sees of a shop’s inventory', () => {
  it('ranks the shop that holds the parts first, and says how many', async () => {
    const buyerRequests = await import('../../user/src/data/requests.js');

    // The reference bill of materials, priced for a batch small enough that the
    // seeded stock covers it.
    const context = {
      requestedServices: ['pcb_fabrication'] as const,
      quantity: 1,
      leadTimeDays: 30,
      billOfMaterials: [
        { sku: 'MCU-STM32F405', quantityPerUnit: 10 },
        { sku: 'RF-SIK868', quantityPerUnit: 10 },
      ],
    };

    const listed = await buyerRequests.listManufacturers(context);
    const shopA = listed.find((option) => option.id === SHOP);
    const shopC = listed.find((option) => option.displayName.includes('AdditiveWorks'));

    // Shop A holds both parts; the third shop holds neither.
    expect(shopA?.fit?.partsCoveredLines).toBe(2);
    expect(shopA?.fit?.partsTotalLines).toBe(2);
    expect(shopA?.fit?.stockCoverage).toBe(1);
    expect(shopC?.fit?.stockCoverage).toBe(0);

    // And it is ranked above a shop that holds nothing, whatever their ratings.
    const positions = listed.map((option) => option.id);
    expect(positions.indexOf(SHOP)).toBeLessThan(
      positions.indexOf(shopC?.id ?? asId<ManufacturerId>('missing')),
    );

    // Nothing about the shop's own stock crosses beyond the count: the option
    // carries no quantities, no costs and no part names.
    const serialised = JSON.stringify(shopA);
    expect(serialised).not.toContain('MCU-STM32F405');
    expect(serialised).not.toContain('unitCost');
    expect(serialised).not.toContain('stockQuantity');
  });

  it('stops counting a part the shop switched off for matching', async () => {
    const buyerRequests = await import('../../user/src/data/requests.js');
    const inventory = await import('../src/data/inventory.js');

    const item = await prisma.inventoryItem.findFirstOrThrow({
      where: { manufacturerId: SHOP, sku: 'RF-SIK868' },
    });
    await inventory.editPart(SHOP, item.id, { enabledForMatching: false });

    const listed = await buyerRequests.listManufacturers({
      requestedServices: ['pcb_fabrication'] as const,
      quantity: 1,
      leadTimeDays: 30,
      billOfMaterials: [
        { sku: 'MCU-STM32F405', quantityPerUnit: 10 },
        { sku: 'RF-SIK868', quantityPerUnit: 10 },
      ],
    });
    expect(listed.find((option) => option.id === SHOP)?.fit?.partsCoveredLines).toBe(1);

    await inventory.editPart(SHOP, item.id, { enabledForMatching: true });
  });

  it('stops counting stock that is already reserved for an order', async () => {
    const buyerRequests = await import('../../user/src/data/requests.js');
    const item = await prisma.inventoryItem.findFirstOrThrow({
      where: { manufacturerId: SHOP, sku: 'RF-SIK868' },
    });
    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { reservedQuantity: item.stockQuantity },
    });

    const listed = await buyerRequests.listManufacturers({
      requestedServices: ['pcb_fabrication'] as const,
      quantity: 1,
      leadTimeDays: 30,
      billOfMaterials: [{ sku: 'RF-SIK868', quantityPerUnit: 1 }],
    });
    expect(listed.find((option) => option.id === SHOP)?.fit?.stockCoverage).toBe(0);

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { reservedQuantity: 0 },
    });
  });
});
