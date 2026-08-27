import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type ManufacturerId, type QuoteId, type RfqId, type UserId } from '@ideeza/domain';
import type * as QuoteData from '../src/data/quotes.js';
import type * as MatchData from '../src/data/inventory-match.js';
import type * as BuyerQuotes from '../../user/src/data/quotes.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

let database: TestDatabase;
let prisma: PrismaClient;
let quotes: typeof QuoteData;
let match: typeof MatchData;
let buyerQuotes: typeof BuyerQuotes;

const SHOP = asId<ManufacturerId>('seed_mfr_a');
const OTHER_SHOP = asId<ManufacturerId>('seed_mfr_b');
const BUYER = asId<UserId>('seed_user_buyer');
const RFQ = asId<RfqId>('quote_rfq');

const inDays = (days: number): Date => new Date(Date.now() + days * 86_400_000);

const terms = {
  unitPriceMinor: 1_240,
  leadTimeDays: 24,
  expiresAt: inDays(21),
  shippingEstimateMinor: 8_400,
  toolingSetupCostMinor: 12_000,
  materialProcessNotes: 'FR-4 TG150, ENIG finish, SMT one side, AOI on 100% of boards.',
  warrantyTerms: '12 months against manufacturing defects.',
  terms: '50% on confirmation, 50% before shipping. Ex-works Dhaka.',
};

/** One open request routed to this shop, asking for two extra volumes. */
const routeRequest = async (): Promise<void> => {
  await prisma.manufacturingPackage.create({
    data: { id: 'quote_package', productId: 'seed_product_sensor_hub', kind: 'pcb' },
  });
  await prisma.manufacturingRequirements.create({
    data: {
      id: 'quote_requirements',
      packageId: 'quote_package',
      quantity: 200,
      material: 'FR-4 TG150',
      manufacturingMethod: 'PCB fabrication + SMT assembly',
      tolerance: '+/-0.15mm',
      leadTimeDays: 20,
      shippingRequirement: 'Courier, tracked',
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
      packageId: 'quote_package',
      requirementsId: 'quote_requirements',
      status: 'submitted',
      quantity: 200,
      requestedServices: ['pcb_fabrication', 'pcb_assembly'],
      volumeTiers: [500, 1_000],
      targetPriceMinor: 260_000n,
      currency: 'USD',
      shipToLine1: '20/3, Sector 9',
      shipToCity: 'Dhaka',
      shipToCountryCode: 'BD',
      neededBy: inDays(60),
      responseDeadline: inDays(10),
      submittedAt: new Date(),
      items: {
        create: [
          {
            id: 'quote_item_u1',
            reference: 'U1',
            componentName: 'STM32F405 MCU',
            manufacturerPartNumber: 'STM32F405RGT6',
            sku: 'MCU-STM32F405',
            quantityRequired: 1,
          },
        ],
      },
      recipients: {
        create: [
          { id: 'quote_recipient_a', manufacturerId: SHOP, status: 'viewed', viewedAt: new Date() },
          { id: 'quote_recipient_b', manufacturerId: OTHER_SHOP, status: 'routed' },
        ],
      },
    },
  });
};

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  quotes = await import('../src/data/quotes.js');
  match = await import('../src/data/inventory-match.js');
  buyerQuotes = await import('../../user/src/data/quotes.js');
  await routeRequest();
});

afterAll(async () => {
  await database?.stop();
});

describe('sending a quote', () => {
  it('refuses terms the domain will not stand behind', async () => {
    const cheap = await quotes.submitQuote(SHOP, RFQ, { ...terms, unitPriceMinor: 0 });
    expect(cheap.ok).toBe(false);

    const late = await quotes.submitQuote(SHOP, RFQ, {
      ...terms,
      expiresAt: inDays(-1),
    });
    expect(late.ok).toBe(false);

    const vague = await quotes.submitQuote(SHOP, RFQ, {
      ...terms,
      materialProcessNotes: 'FR4',
    });
    expect(vague.ok).toBe(false);
  });

  it('refuses a volume the request never asked about', async () => {
    const result = await quotes.submitQuote(SHOP, RFQ, {
      ...terms,
      volumePrices: [{ quantity: 5_000, unitPriceMinor: 900 }],
    });
    expect(result.ok).toBe(false);
  });

  it('takes the quantity from the request, and computes the totals', async () => {
    const result = await quotes.submitQuote(SHOP, RFQ, {
      ...terms,
      volumePrices: [
        { quantity: 500, unitPriceMinor: 1_150, leadTimeDays: 28 },
        { quantity: 1_000, unitPriceMinor: 1_040, leadTimeDays: null },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await prisma.quote.findUniqueOrThrow({
      where: { id: result.quoteId },
      include: { volumePrices: { orderBy: { quantity: 'asc' } } },
    });
    expect(row.status).toBe('submitted');
    expect(row.quantity).toBe(200);
    expect(Number(row.totalPriceMinor)).toBe(1_240 * 200);
    expect(row.volumePrices.map((price) => Number(price.totalPriceMinor))).toEqual([
      1_150 * 500,
      1_040 * 1_000,
    ]);

    // The routing record now says this shop has answered.
    const recipient = await prisma.rfqRecipient.findFirstOrThrow({
      where: { rfqId: RFQ, manufacturerId: SHOP },
    });
    expect(recipient.status).toBe('quoted');
    expect(recipient.quotedAt).not.toBeNull();

    const event = await prisma.domainEvent.findFirstOrThrow({
      where: { kind: 'quote_submitted', subjectId: result.quoteId },
    });
    expect(event.actorManufacturerId).toBe(SHOP);
  });

  it('refuses a second quote on the same request', async () => {
    const again = await quotes.submitQuote(SHOP, RFQ, terms);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.message).toMatch(/already quoted/);
  });

  it('is what the buyer reads, field for field', async () => {
    const mine = (await quotes.listQuotes(SHOP)).rows.find(
      (row) => row.rfqId === RFQ,
    );
    expect(mine).toBeDefined();

    const theirs = (await buyerQuotes.listQuotes(BUYER, RFQ)).find(
      (quote) => quote.manufacturerId === SHOP,
    );
    expect(theirs).toBeDefined();

    expect(Number(theirs?.unitPriceMinor)).toBe(mine?.unitPriceMinor);
    expect(Number(theirs?.totalPriceMinor)).toBe(mine?.totalPriceMinor);
    expect(theirs?.leadTimeDays).toBe(mine?.leadTimeDays);
    expect(theirs?.quantity).toBe(mine?.quantity);
    expect(theirs?.expiresAt.getTime()).toBe(mine?.expiresAt.getTime());
    expect(theirs?.materialProcessNotes).toBe(terms.materialProcessNotes);
    expect(theirs?.terms).toBe(terms.terms);
    expect(theirs?.warrantyTerms).toBe(terms.warrantyTerms);
    expect(theirs?.volumePrices.map((price) => price.quantity)).toEqual([500, 1_000]);
    expect(Number(theirs?.volumePrices[0]?.unitPriceMinor)).toBe(1_150);
  });
});

describe('revising a quote', () => {
  it('keeps what it said before, and tells the buyer the new terms', async () => {
    const quote = await prisma.quote.findFirstOrThrow({
      where: { rfqId: RFQ, manufacturerId: SHOP },
    });

    const revised = await quotes.reviseQuote(SHOP, asId<QuoteId>(quote.id), {
      ...terms,
      unitPriceMinor: 1_180,
      leadTimeDays: 21,
      volumePrices: [{ quantity: 500, unitPriceMinor: 1_120 }],
    });
    expect(revised.ok).toBe(true);

    const after = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
      include: { revisions: true, volumePrices: true },
    });
    expect(after.status).toBe('revised');
    expect(Number(after.unitPriceMinor)).toBe(1_180);
    expect(Number(after.totalPriceMinor)).toBe(1_180 * 200);
    expect(after.revisions.length).toBe(1);
    expect(
      Number((after.revisions[0]?.previousTerms as Record<string, number>)['unitPriceMinor']),
    ).toBe(1_240);
    // The tier that was dropped from the revision is gone, not stale.
    expect(after.volumePrices.map((price) => price.quantity)).toEqual([500]);

    const theirs = (await buyerQuotes.listQuotes(BUYER, RFQ)).find(
      (candidate) => candidate.manufacturerId === SHOP,
    );
    expect(Number(theirs?.unitPriceMinor)).toBe(1_180);
    expect(theirs?.status).toBe('revised');
  });

  it('refuses to revise another shop’s quote', async () => {
    const quote = await prisma.quote.findFirstOrThrow({
      where: { rfqId: RFQ, manufacturerId: SHOP },
    });
    const refused = await quotes.reviseQuote(OTHER_SHOP, asId<QuoteId>(quote.id), terms);
    expect(refused.ok).toBe(false);
  });
});

describe('what the shop can read', () => {
  it('counts its own quotes and nobody else’s', async () => {
    const counters = await quotes.quoteCounters(SHOP);
    const list = await quotes.listQuotes(SHOP);
    expect(counters.total).toBe(list.total);
    expect(list.rows.every((row) => row.quoteId !== undefined)).toBe(true);

    expect((await quotes.listQuotes(OTHER_SHOP)).rows.some((row) => row.rfqId === RFQ)).toBe(
      false,
    );
  });

  it('refuses to read another shop’s quote in detail', async () => {
    const quote = await prisma.quote.findFirstOrThrow({
      where: { rfqId: RFQ, manufacturerId: SHOP },
    });
    await expect(
      quotes.getQuote(OTHER_SHOP, asId<QuoteId>(quote.id)),
    ).rejects.toThrow(/only read its own quotes/);
  });

  it('reads the request beside the quote, and the activity of it', async () => {
    const quote = await prisma.quote.findFirstOrThrow({
      where: { rfqId: RFQ, manufacturerId: SHOP },
    });
    const detail = await quotes.getQuote(SHOP, asId<QuoteId>(quote.id));

    expect(detail?.requestQuantity).toBe(200);
    expect(detail?.requestVolumeTiers).toEqual([500, 1_000]);
    expect(detail?.requestTargetPriceMinor).toBe(260_000);
    expect(detail?.bomLineCount).toBe(1);
    expect(detail?.revisions.length).toBe(1);

    const activity = await quotes.listQuoteActivity(SHOP, asId<QuoteId>(quote.id));
    expect(activity.map((entry) => entry.kind)).toContain('quote_submitted');
    expect(activity.map((entry) => entry.kind)).toContain('quote_revised');
  });

  it('says a quote is expired once the date has passed, on both sides', async () => {
    const quote = await prisma.quote.findFirstOrThrow({
      where: { rfqId: RFQ, manufacturerId: SHOP },
    });
    await prisma.quote.update({
      where: { id: quote.id },
      data: { expiresAt: inDays(-1) },
    });

    const detail = await quotes.getQuote(SHOP, asId<QuoteId>(quote.id));
    expect(detail?.expired).toBe(true);
    expect(detail?.revisable).toBe(false);

    const theirs = (await buyerQuotes.listQuotes(BUYER, RFQ)).find(
      (candidate) => candidate.manufacturerId === SHOP,
    );
    expect(theirs?.expired).toBe(true);

    await prisma.quote.update({
      where: { id: quote.id },
      data: { expiresAt: inDays(21) },
    });
  });
});

describe('withdrawing a quote', () => {
  it('takes it off the table without deleting the record', async () => {
    const quote = await prisma.quote.findFirstOrThrow({
      where: { rfqId: RFQ, manufacturerId: SHOP },
    });

    const result = await quotes.withdrawQuote(SHOP, asId<QuoteId>(quote.id));
    expect(result.ok).toBe(true);

    const after = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(after.status).toBe('withdrawn');

    const theirs = (await buyerQuotes.listQuotes(BUYER, RFQ)).find(
      (candidate) => candidate.manufacturerId === SHOP,
    );
    expect(theirs?.status).toBe('withdrawn');

    // And it cannot be revised any more.
    const revised = await quotes.reviseQuote(SHOP, asId<QuoteId>(quote.id), terms);
    expect(revised.ok).toBe(false);
  });
});

describe('a draft quote becomes the sent quote', () => {
  it('carries the substitute suggestions with it', async () => {
    // A second request, so the first one keeps its history.
    await prisma.rfq.create({
      data: {
        id: 'quote_rfq_draft',
        buyerId: BUYER,
        packageId: 'quote_package',
        requirementsId: 'quote_requirements',
        status: 'submitted',
        quantity: 100,
        requestedServices: [],
        volumeTiers: [],
        currency: 'USD',
        shipToLine1: '20/3, Sector 9',
        shipToCity: 'Dhaka',
        shipToCountryCode: 'BD',
        submittedAt: new Date(),
        items: {
          create: [
            {
              id: 'quote_draft_item',
              reference: 'C1',
              componentName: 'Bulk capacitor 470uF',
              sku: 'CAP-470U63V',
              quantityRequired: 2,
            },
          ],
        },
        recipients: {
          create: [{ id: 'quote_draft_recipient', manufacturerId: SHOP, status: 'viewed' }],
        },
      },
    });
    await prisma.inventoryItem.create({
      data: {
        id: 'quote_inv_cap',
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

    const suggested = await match.saveSubstituteSuggestions(
      SHOP,
      asId<RfqId>('quote_rfq_draft'),
      [
        {
          rfqItemId: 'quote_draft_item',
          inventoryItemId: 'quote_inv_cap',
          justification: 'Same 470uF capacitance at a higher voltage rating.',
        },
      ],
    );
    expect(suggested.ok).toBe(true);

    // Nothing is with the buyer yet.
    expect((await buyerQuotes.listQuotes(BUYER, asId<RfqId>('quote_rfq_draft'))).length).toBe(
      0,
    );

    const sent = await quotes.submitQuote(SHOP, asId<RfqId>('quote_rfq_draft'), terms);
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;

    const theirs = await buyerQuotes.listQuotes(BUYER, asId<RfqId>('quote_rfq_draft'));
    expect(theirs.length).toBe(1);
    expect(theirs[0]?.id).toBe(sent.quoteId);
    expect(theirs[0]?.substitutions.length).toBe(1);
    expect(theirs[0]?.substitutions[0]?.status).toBe('proposed');
  });
});
