import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type ManufacturerId, type RfqId, type UserId } from '@ideeza/domain';
import type * as MatchData from '../src/data/inventory-match.js';
import type * as BuyerQuotes from '../../user/src/data/quotes.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

let database: TestDatabase;
let prisma: PrismaClient;
let match: typeof MatchData;
let buyerQuotes: typeof BuyerQuotes;

const SHOP = asId<ManufacturerId>('seed_mfr_a');
const OTHER_SHOP = asId<ManufacturerId>('seed_mfr_b');
const BUYER = asId<UserId>('seed_user_buyer');
const RFQ = asId<RfqId>('match_rfq');

/**
 * One request whose bill of materials has a line of each kind against this
 * shop's stock: covered, short, and not stocked at all.
 */
const routeRequest = async (): Promise<void> => {
  await prisma.manufacturingPackage.create({
    data: { id: 'match_package', productId: 'seed_product_sensor_hub', kind: 'pcb' },
  });
  await prisma.manufacturingRequirements.create({
    data: {
      id: 'match_requirements',
      packageId: 'match_package',
      quantity: 100,
      material: 'FR-4',
      manufacturingMethod: 'PCB fabrication + SMT assembly',
      tolerance: '+/-0.15mm',
      leadTimeDays: 20,
      shippingRequirement: 'Courier',
      assembly: 'smt',
      qualityCheckRequirement: 'AOI on 100%',
      substitutionPolicy: 'with_approval',
      lockedAt: new Date(),
    },
  });
  await prisma.rfq.create({
    data: {
      id: RFQ,
      buyerId: BUYER,
      packageId: 'match_package',
      requirementsId: 'match_requirements',
      status: 'submitted',
      quantity: 100,
      requestedServices: ['pcb_fabrication', 'parts_sourcing', 'pcb_assembly'],
      volumeTiers: [],
      currency: 'USD',
      shipToLine1: '20/3, Sector 9',
      shipToCity: 'Dhaka',
      shipToCountryCode: 'BD',
      submittedAt: new Date(),
      items: {
        create: [
          {
            id: 'match_item_covered',
            reference: 'U1',
            componentName: 'STM32F405 MCU',
            manufacturerPartNumber: 'STM32F405RGT6',
            sku: 'MCU-STM32F405',
            quantityRequired: 1,
          },
          {
            id: 'match_item_short',
            reference: 'U2',
            componentName: 'SiK telemetry radio 868MHz',
            manufacturerPartNumber: 'SIK-868-V3',
            sku: 'RF-SIK868',
            quantityRequired: 5,
          },
          {
            id: 'match_item_absent',
            reference: 'U3',
            componentName: 'Bulk capacitor 470uF',
            manufacturerPartNumber: 'EEU-FR1J471',
            sku: 'CAP-470U63V',
            quantityRequired: 2,
          },
        ],
      },
      recipients: {
        create: [{ id: 'match_recipient', manufacturerId: SHOP, status: 'routed' }],
      },
    },
  });

  // Something that can stand in for the capacitor, and enough of it.
  await prisma.inventoryItem.create({
    data: {
      id: 'match_inv_cap',
      manufacturerId: SHOP,
      partName: 'Bulk capacitor 470uF 100V',
      sku: 'CAP-470U100V',
      category: 'Electrolytic capacitors',
      stockQuantity: 900,
      reservedQuantity: 0,
      currency: 'USD',
      unitCostMinor: 210n,
      leadTimeDays: 9,
    },
  });
};

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  match = await import('../src/data/inventory-match.js');
  buyerQuotes = await import('../../user/src/data/quotes.js');
  await routeRequest();
});

afterAll(async () => {
  await database?.stop();
});

describe('the bill of materials against this shop’s stock', () => {
  it('separates covered, short and not stocked', async () => {
    const result = await match.matchRequestAgainstInventory(SHOP, RFQ);
    expect(result).not.toBeNull();

    const byReference = new Map(
      (result?.lines ?? []).map((line) => [line.reference, line]),
    );

    // 1 each of 100 units, and the shop holds 1200 with 500 reserved.
    expect(byReference.get('U1')?.coverage).toBe('covered');
    expect(byReference.get('U1')?.requiredTotal).toBe(100);

    // 5 each of 100 units is 500, and the shop holds 300.
    expect(byReference.get('U2')?.coverage).toBe('short');
    expect(byReference.get('U2')?.shortfall).toBe(200);

    // Not in the inventory at all.
    expect(byReference.get('U3')?.coverage).toBe('missing');
    expect(byReference.get('U3')?.held).toBeNull();

    expect(result?.shortLines.length).toBe(2);
    expect(result?.unanswered).toBe(2);
  });

  it('counts what is reserved for other orders as unavailable', async () => {
    await prisma.inventoryItem.update({
      where: { manufacturerId_sku: { manufacturerId: SHOP, sku: 'MCU-STM32F405' } },
      data: { reservedQuantity: 1_150 },
    });
    const tight = await match.matchRequestAgainstInventory(SHOP, RFQ);
    expect(
      tight?.lines.find((line) => line.reference === 'U1')?.coverage,
    ).toBe('short');

    await prisma.inventoryItem.update({
      where: { manufacturerId_sku: { manufacturerId: SHOP, sku: 'MCU-STM32F405' } },
      data: { reservedQuantity: 500 },
    });
  });

  it('ignores stock the shop switched off for matching', async () => {
    await prisma.inventoryItem.update({
      where: { manufacturerId_sku: { manufacturerId: SHOP, sku: 'MCU-STM32F405' } },
      data: { enabledForMatching: false },
    });
    const without = await match.matchRequestAgainstInventory(SHOP, RFQ);
    expect(without?.lines.find((line) => line.reference === 'U1')?.coverage).toBe(
      'missing',
    );

    await prisma.inventoryItem.update({
      where: { manufacturerId_sku: { manufacturerId: SHOP, sku: 'MCU-STM32F405' } },
      data: { enabledForMatching: true },
    });
  });

  it('offers only substitutes it holds enough of', async () => {
    const result = await match.matchRequestAgainstInventory(SHOP, RFQ);
    const absent = result?.lines.find((line) => line.reference === 'U3');

    expect(absent?.candidates.map((candidate) => candidate.sku)).toContain(
      'CAP-470U100V',
    );
    expect(
      absent?.candidates.every((candidate) => candidate.available >= 200),
    ).toBe(true);
  });

  it('is nothing at all for a shop the request was not routed to', async () => {
    expect(await match.matchRequestAgainstInventory(OTHER_SHOP, RFQ)).toBeNull();
  });
});

describe('suggesting a substitute', () => {
  it('refuses a substitute the shop is also short of', async () => {
    await prisma.inventoryItem.update({
      where: { id: 'match_inv_cap' },
      data: { stockQuantity: 50 },
    });

    const refused = await match.saveSubstituteSuggestions(SHOP, RFQ, [
      {
        rfqItemId: 'match_item_absent',
        inventoryItemId: 'match_inv_cap',
        justification: 'Same capacitance, higher voltage rating, identical footprint.',
      },
    ]);
    expect(refused.ok).toBe(false);

    await prisma.inventoryItem.update({
      where: { id: 'match_inv_cap' },
      data: { stockQuantity: 900 },
    });
  });

  it('refuses one with no reason the buyer could judge', async () => {
    const refused = await match.saveSubstituteSuggestions(SHOP, RFQ, [
      {
        rfqItemId: 'match_item_absent',
        inventoryItemId: 'match_inv_cap',
        justification: 'ok',
      },
    ]);
    expect(refused.ok).toBe(false);
  });

  it('writes it onto a draft quote the buyer cannot see', async () => {
    const saved = await match.saveSubstituteSuggestions(SHOP, RFQ, [
      {
        rfqItemId: 'match_item_absent',
        inventoryItemId: 'match_inv_cap',
        justification: 'Same 470uF capacitance, 100V rating, identical can and footprint.',
      },
    ]);
    expect(saved.ok).toBe(true);

    const quote = await prisma.quote.findFirstOrThrow({
      where: { rfqId: RFQ, manufacturerId: SHOP },
      include: { substitutions: true },
    });
    expect(quote.status).toBe('draft');
    expect(quote.substitutions.length).toBe(1);
    expect(quote.substitutions[0]?.status).toBe('proposed');

    // The impact is derived: the specified part is not in this inventory, so
    // there is no cost on record to compare against.
    expect(Number(quote.substitutions[0]?.priceImpactMinor)).toBe(0);

    // And the buyer sees nothing of it while the quote is a draft.
    const seenByBuyer = await buyerQuotes.listQuotes(BUYER, RFQ);
    expect(seenByBuyer.length).toBe(0);

    const after = await match.matchRequestAgainstInventory(SHOP, RFQ);
    expect(after?.unanswered).toBe(1);
    expect(
      after?.lines.find((line) => line.reference === 'U3')?.suggestion?.suggestedPartName,
    ).toBe('Bulk capacitor 470uF 100V');
  });

  it('prices the difference when the shop holds the specified part too', async () => {
    const saved = await match.saveSubstituteSuggestions(SHOP, RFQ, [
      {
        rfqItemId: 'match_item_short',
        inventoryItemId: 'seed_inventory_a1',
        justification:
          'Not a real electrical equivalent, used here only to check the arithmetic.',
      },
    ]);
    expect(saved.ok).toBe(true);

    const substitution = await prisma.substitution.findFirstOrThrow({
      where: { rfqItemId: 'match_item_short' },
    });
    // The radio costs 1850 and the MCU 620, for 500 parts: a saving.
    expect(Number(substitution.priceImpactMinor)).toBe((620 - 1_850) * 500);
    expect(substitution.leadTimeImpactDays).toBe(0);

    const answered = await match.matchRequestAgainstInventory(SHOP, RFQ);
    expect(answered?.unanswered).toBe(0);
  });

  it('withdraws one when the shop clears the choice', async () => {
    const cleared = await match.saveSubstituteSuggestions(SHOP, RFQ, [
      { rfqItemId: 'match_item_short', inventoryItemId: null, justification: '' },
    ]);
    expect(cleared.ok).toBe(true);
    expect(
      await prisma.substitution.findFirst({ where: { rfqItemId: 'match_item_short' } }),
    ).toBeNull();
  });

  it('refuses any suggestion when the buyer allowed no substitutions', async () => {
    await prisma.manufacturingRequirements.update({
      where: { id: 'match_requirements' },
      data: { substitutionPolicy: 'not_allowed' },
    });

    const refused = await match.saveSubstituteSuggestions(SHOP, RFQ, [
      {
        rfqItemId: 'match_item_absent',
        inventoryItemId: 'match_inv_cap',
        justification: 'Same 470uF capacitance, 100V rating, identical can and footprint.',
      },
    ]);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toMatch(/does not allow substitutions/);

    await prisma.manufacturingRequirements.update({
      where: { id: 'match_requirements' },
      data: { substitutionPolicy: 'with_approval' },
    });
  });

  it('shows the buyer’s decision back to the shop', async () => {
    const substitution = await prisma.substitution.findFirstOrThrow({
      where: { rfqItemId: 'match_item_absent' },
    });

    // The buyer decides on a submitted quote; the decision itself is theirs, so
    // this writes only what their own screen would write.
    await prisma.quote.update({
      where: { id: substitution.quoteId },
      data: { status: 'submitted', submittedAt: new Date(), unitPriceMinor: 400n, totalPriceMinor: 40_000n },
    });
    await buyerQuotes.decideSubstitution(BUYER, substitution.id, 'approved');

    const seen = await match.matchRequestAgainstInventory(SHOP, RFQ);
    const line = seen?.lines.find((candidate) => candidate.reference === 'U3');
    expect(line?.suggestion?.status).toBe('approved');
    expect(line?.suggestion?.decidedAt).not.toBeNull();
  });

  it('refuses to change what a sent quote already offers', async () => {
    const refused = await match.saveSubstituteSuggestions(SHOP, RFQ, [
      {
        rfqItemId: 'match_item_short',
        inventoryItemId: 'match_inv_cap',
        justification: 'Trying to change a suggestion after the quote went out.',
      },
    ]);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toMatch(/already been sent/);
  });
});
