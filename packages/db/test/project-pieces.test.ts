import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../prisma/seed.js';
import { startTestDatabase, type TestDatabase } from '../test-support/index.js';

/**
 * UIUX-207. Every request in this platform says, in as many words, that it
 * covers one part of a project and that "anything else in it travels as its own
 * request". That sentence was a claim with nothing behind it: no project in the
 * demo database had a second piece, so a reviewer reading it had no way to see
 * what it was promising, and the page read as though it had lost the others.
 *
 * A project with two pieces is what makes the sentence checkable.
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

describe('a project that is made of more than one piece', () => {
  it('holds two packages, not one', async () => {
    const packages = await prisma.manufacturingPackage.findMany({
      where: { productId: 'seed_product_drone' },
      orderBy: { createdAt: 'asc' },
    });

    expect(packages).toHaveLength(2);
    expect(packages.map((row) => row.kind)).toEqual(['full_product', 'pcb']);
  });

  it('sends each piece to the shop as its own request', async () => {
    const requests = await prisma.rfq.findMany({
      where: { package: { productId: 'seed_product_drone' } },
    });

    expect(requests.length).toBe(2);
    // Two requests, two packages — never two requests on one package, which is
    // what would make "its own request" untrue in the other direction.
    expect(new Set(requests.map((row) => row.packageId)).size).toBe(2);
  });

  it('routes the second piece to the same shop, so one shop can see both', async () => {
    // Without this the sibling is real but invisible: a manufacturer reads a
    // request only through its routing row, and showing them a package nobody
    // sent them would be a leak rather than a feature.
    const routed = await prisma.rfqRecipient.findMany({
      where: {
        manufacturerId: 'seed_mfr_a',
        rfq: { package: { productId: 'seed_product_drone' } },
      },
    });

    expect(routed.length).toBe(2);
  });
});

/**
 * The sibling list is a read like any other: scoped by who was sent what. A
 * project belongs to the buyer, and the pieces of it a shop may see are the
 * ones routed to that shop.
 */
describe('who may see a project’s other pieces', () => {
  it('shows a shop only the pieces it was sent', async () => {
    const forShopA = await prisma.rfq.findMany({
      where: {
        package: { productId: 'seed_product_drone' },
        recipients: { some: { manufacturerId: 'seed_mfr_a' } },
      },
    });
    const forShopC = await prisma.rfq.findMany({
      where: {
        package: { productId: 'seed_product_drone' },
        recipients: { some: { manufacturerId: 'seed_mfr_c' } },
      },
    });

    expect(forShopA.length).toBe(2);
    // A shop nobody routed this project to learns nothing about it, which is
    // the difference between naming the siblings and leaking the buyer's plans.
    expect(forShopC).toHaveLength(0);
  });
});
