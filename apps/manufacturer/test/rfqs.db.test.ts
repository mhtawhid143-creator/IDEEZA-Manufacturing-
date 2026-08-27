import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type ManufacturerId, type RfqId, type UserId } from '@ideeza/domain';
import type * as RfqData from '../src/data/rfqs.js';
import type * as ClientData from '../src/data/clients.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

let database: TestDatabase;
let prisma: PrismaClient;
let rfqs: typeof RfqData;
let clients: typeof ClientData;

const SHOP = asId<ManufacturerId>('seed_mfr_a');
const OTHER_SHOP = asId<ManufacturerId>('seed_mfr_b');
const BUYER = asId<UserId>('seed_user_buyer');
const SEEDED_RFQ = asId<RfqId>('seed_rfq_1');

/**
 * A second request, unanswered, routed to shop A only.
 *
 * The reference seed leaves every routed request already quoted, which is not the
 * state an inbox is interesting in. This adds the one an inbox is about.
 */
const routeFreshRequest = async (): Promise<RfqId> => {
  await prisma.fileRef.create({
    data: {
      id: 'test_file_fresh_gerber',
      name: 'sensor-hub-gerber.zip',
      contentHash: 'testhash-sensor-hub-gerber',
      byteSize: 401_112,
    },
  });
  await prisma.manufacturingPackage.create({
    data: {
      id: 'test_package_fresh',
      productId: 'seed_product_sensor_hub',
      kind: 'pcb',
      files: { create: [{ fileId: 'test_file_fresh_gerber' }] },
    },
  });
  await prisma.manufacturingRequirements.create({
    data: {
      id: 'test_requirements_fresh',
      packageId: 'test_package_fresh',
      quantity: 200,
      material: 'FR-4 TG150',
      manufacturingMethod: 'PCB fabrication + SMT assembly',
      tolerance: '+/-0.15mm',
      leadTimeDays: 20,
      shippingRequirement: 'Courier, tracked',
      assembly: 'smt',
      assemblySides: 'single_side',
      qualityCheckRequirement: 'AOI on 100%',
      substitutionPolicy: 'with_approval',
      lockedAt: new Date(),
      boardSpec: {
        create: {
          baseMaterial: 'fr4',
          layerCount: 4,
          surfaceFinish: 'enig',
          workmanshipClass: 'ipc_class_3',
          electricalTest: 'flying_probe_full',
          functionalTest: true,
        },
      },
    },
  });
  await prisma.rfq.create({
    data: {
      id: 'test_rfq_fresh',
      buyerId: BUYER,
      packageId: 'test_package_fresh',
      requirementsId: 'test_requirements_fresh',
      status: 'submitted',
      quantity: 200,
      requestedServices: ['pcb_fabrication', 'pcb_assembly'],
      volumeTiers: [200],
      currency: 'USD',
      shipToLine1: '20/3, Sector 9',
      shipToCity: 'Dhaka',
      shipToCountryCode: 'BD',
      submittedAt: new Date(),
      items: {
        create: [
          {
            id: 'test_item_u1',
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
          {
            id: 'test_recipient_fresh_a',
            manufacturerId: SHOP,
            status: 'routed',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
  });
  return asId<RfqId>('test_rfq_fresh');
};

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  rfqs = await import('../src/data/rfqs.js');
  clients = await import('../src/data/clients.js');
  await routeFreshRequest();
});

afterAll(async () => {
  await database?.stop();
});

describe('the inbox is this shop’s routing records', () => {
  it('lists only what was routed here', async () => {
    const page = await rfqs.listRoutedRequests(SHOP);
    expect(page.rows.map((row) => row.rfqId)).toContain('test_rfq_fresh');
    expect(page.rows.map((row) => row.rfqId)).toContain(SEEDED_RFQ);
    expect(page.total).toBe(page.rows.length);

    // A request routed to the other shop only is invisible here.
    await prisma.rfqRecipient.deleteMany({
      where: { rfqId: 'test_rfq_fresh', manufacturerId: SHOP },
    });
    await prisma.rfqRecipient.create({
      data: {
        id: 'test_recipient_fresh_b',
        rfqId: 'test_rfq_fresh',
        manufacturerId: OTHER_SHOP,
        status: 'routed',
      },
    });
    const afterReroute = await rfqs.listRoutedRequests(SHOP);
    expect(afterReroute.rows.map((row) => row.rfqId)).not.toContain('test_rfq_fresh');
    expect(
      (await rfqs.listRoutedRequests(OTHER_SHOP)).rows.map((row) => row.rfqId),
    ).toContain('test_rfq_fresh');

    // Put it back where the rest of this suite expects it.
    await prisma.rfqRecipient.deleteMany({
      where: { rfqId: 'test_rfq_fresh', manufacturerId: OTHER_SHOP },
    });
    await prisma.rfqRecipient.create({
      data: {
        id: 'test_recipient_fresh_a2',
        rfqId: 'test_rfq_fresh',
        manufacturerId: SHOP,
        status: 'routed',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  });

  it('never shows a draft, which was never sent', async () => {
    await prisma.rfq.update({
      where: { id: 'test_rfq_fresh' },
      data: { status: 'draft' },
    });
    const hidden = await rfqs.listRoutedRequests(SHOP);
    expect(hidden.rows.map((row) => row.rfqId)).not.toContain('test_rfq_fresh');
    await prisma.rfq.update({
      where: { id: 'test_rfq_fresh' },
      data: { status: 'submitted' },
    });
  });

  it('filters by routing state and by kind of work together', async () => {
    const quoted = await rfqs.listRoutedRequests(SHOP, { status: 'quoted' });
    expect(quoted.rows.length).toBeGreaterThan(0);
    expect(quoted.rows.every((row) => row.status === 'quoted')).toBe(true);

    const waiting = await rfqs.listRoutedRequests(SHOP, { status: 'routed' });
    expect(waiting.rows.map((row) => row.rfqId)).toEqual(['test_rfq_fresh']);

    const boards = await rfqs.listRoutedRequests(SHOP, { kind: 'pcb' });
    expect(boards.rows.every((row) => row.kind === 'pcb')).toBe(true);

    const searched = await rfqs.listRoutedRequests(SHOP, {
      kind: 'pcb',
      search: 'sensor',
    });
    expect(searched.rows.map((row) => row.rfqId)).toEqual(['test_rfq_fresh']);
    expect(
      (await rfqs.listRoutedRequests(SHOP, { search: 'nothing called this' })).total,
    ).toBe(0);
  });

  it('pages without losing the count of what matched', async () => {
    const all = await rfqs.listRoutedRequests(SHOP);
    const firstPage = await rfqs.listRoutedRequests(SHOP, { pageSize: 1, page: 1 });
    expect(firstPage.rows.length).toBe(1);
    expect(firstPage.total).toBe(all.total);
    expect(firstPage.pageCount).toBe(all.total);

    // A page number past the end lands on the last page rather than on nothing.
    const past = await rfqs.listRoutedRequests(SHOP, { pageSize: 1, page: 999 });
    expect(past.page).toBe(past.pageCount);
    expect(past.rows.length).toBe(1);
  });

  it('counts the inbox the way the cards read it', async () => {
    const counters = await rfqs.inboxCounters(SHOP);
    const all = await rfqs.listRoutedRequests(SHOP);
    expect(counters.total).toBe(all.total);
    expect(counters.awaiting + counters.quoted + counters.declined + counters.expired).toBe(
      counters.total,
    );
  });
});

describe('one request, read by the shop it was routed to', () => {
  it('carries the files, the lines and the frozen specification', async () => {
    const detail = await rfqs.getRoutedRequest(SHOP, asId<RfqId>('test_rfq_fresh'));
    expect(detail).not.toBeNull();
    expect(detail?.open).toBe(true);
    expect(detail?.bomLines.map((line) => line.reference)).toEqual(['U1']);
    expect(detail?.files.map((file) => file.kind)).toEqual(['pcb']);
    expect(detail?.requirementsLockedAt).not.toBeNull();
    expect(detail?.serviceLabels).toContain('Fabrication');

    // The specification is read in words, never in stored tokens.
    const values = (detail?.boardSpecRows ?? []).map((row) => row.value);
    expect(values).toContain('ENIG');
    expect(values.some((value) => value.includes('_'))).toBe(false);
  });

  it('refuses a request that was never routed here', async () => {
    expect(
      await rfqs.getRoutedRequest(SHOP, asId<RfqId>('verify_rfq_does_not_exist')),
    ).toBeNull();

    // A real request belonging to another shop only: also nothing, and by the
    // same rule rather than by a lucky empty query.
    await prisma.rfq.create({
      data: {
        id: 'test_rfq_other_shop',
        buyerId: BUYER,
        packageId: 'test_package_fresh',
        requirementsId: 'test_requirements_fresh',
        status: 'submitted',
        quantity: 10,
        requestedServices: [],
        volumeTiers: [],
        currency: 'USD',
        shipToLine1: '1 Road',
        shipToCity: 'Dhaka',
        shipToCountryCode: 'BD',
        submittedAt: new Date(),
        recipients: {
          create: [
            {
              id: 'test_recipient_other',
              manufacturerId: OTHER_SHOP,
              status: 'routed',
            },
          ],
        },
      },
    });
    expect(
      await rfqs.getRoutedRequest(SHOP, asId<RfqId>('test_rfq_other_shop')),
    ).toBeNull();
    expect(
      await rfqs.getRoutedRequest(OTHER_SHOP, asId<RfqId>('test_rfq_other_shop')),
    ).not.toBeNull();
  });

  it('records that the shop opened it, once, with an event', async () => {
    const id = asId<RfqId>('test_rfq_fresh');
    await rfqs.markRequestViewed(SHOP, id);

    const recipient = await prisma.rfqRecipient.findFirstOrThrow({
      where: { rfqId: 'test_rfq_fresh', manufacturerId: SHOP },
    });
    expect(recipient.status).toBe('viewed');
    expect(recipient.viewedAt).not.toBeNull();

    const first = recipient.viewedAt;
    await rfqs.markRequestViewed(SHOP, id);
    const again = await prisma.rfqRecipient.findFirstOrThrow({
      where: { rfqId: 'test_rfq_fresh', manufacturerId: SHOP },
    });
    expect(again.viewedAt?.getTime()).toBe(first?.getTime());

    const events = await prisma.domainEvent.count({
      where: { subjectId: recipient.id, kind: 'rfq_recipient_viewed' },
    });
    expect(events).toBe(1);
  });
});

describe('declining is an answer, and it is recorded as one', () => {
  it('refuses to decline a request that has already been quoted', async () => {
    const result = await rfqs.declineRequest(SHOP, SEEDED_RFQ, {
      reason: 'capacity_unavailable',
    });
    expect(result.ok).toBe(false);
  });

  it('records the reason, and the buyer can read it', async () => {
    const id = asId<RfqId>('test_rfq_fresh');
    const result = await rfqs.declineRequest(SHOP, id, {
      reason: 'parts_unavailable',
      note: 'The gate driver is on 40 week lead time everywhere we buy.',
    });
    expect(result.ok).toBe(true);

    const detail = await rfqs.getRoutedRequest(SHOP, id);
    expect(detail?.status).toBe('declined');
    expect(detail?.declineReasonLabel).toBe(
      'Parts on the bill of materials cannot be sourced',
    );

    const event = await prisma.domainEvent.findFirst({
      where: { kind: 'rfq_recipient_declined' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(event?.actorManufacturerId).toBe(SHOP);

    // And it cannot be declined twice.
    const second = await rfqs.declineRequest(SHOP, id, { reason: 'other', note: 'x' });
    expect(second.ok).toBe(false);
  });
});

describe('the client panel says only what the platform knows', () => {
  it('reads the buyer’s record rather than inventing a profile', async () => {
    const profile = await clients.getClientProfile(BUYER, SHOP);
    expect(profile?.displayName).toBe('Nova Robotics (Buyer)');
    expect(profile?.requestsSent).toBeGreaterThan(0);
    expect(profile?.ordersWithThisShop).toBeGreaterThan(0);
    expect(profile?.worksOn.length).toBeGreaterThan(0);
    expect(profile?.worksOn.every((label) => !label.includes('_'))).toBe(true);
  });

  it('is null for someone who does not exist', async () => {
    expect(await clients.getClientProfile(asId<UserId>('nobody'), SHOP)).toBeNull();
  });
});
