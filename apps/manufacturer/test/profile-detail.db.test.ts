import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type ManufacturerId } from '@ideeza/domain';
import type * as Profile from '../src/data/profile.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import { startTestDatabase, type TestDatabase } from '../../../packages/db/test-support/index.js';

/**
 * The profile beyond the address.
 *
 * Everything here used to be drawn from a constant with a warning under it,
 * because there was nowhere to keep it. Now that there is, the tests worth
 * having are the ones about not losing it: a partial edit must not erase the
 * fields it cannot see, a link that does not open must be refused, and a shop
 * must not be able to touch another shop's floor list.
 */
let database: TestDatabase;
let prisma: PrismaClient;
let profile: typeof Profile;

const SHOP = asId<ManufacturerId>('seed_mfr_a');
const OTHER = asId<ManufacturerId>('seed_mfr_b');

/** What the settings screen sends: the address, and nothing else. */
const addressOnly = {
  displayName: 'PrecisionCircuit Co.',
  legalName: 'PrecisionCircuit Manufacturing Ltd.',
  addressLine1: '88 Bao An Road',
  addressLine2: '',
  city: 'Shenzhen',
  region: '',
  postalCode: '',
  countryCode: 'CN',
};

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  profile = await import('../src/data/profile.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('the profile a buyer reads', () => {
  it('returns the shop’s own words, floor list, sheets and writing', async () => {
    const shop = await profile.getShopProfile(SHOP);
    expect(shop).not.toBeNull();
    if (shop === null) return;

    expect(shop.about).toBeTruthy();
    expect(shop.tagline).toBeTruthy();
    expect(shop.phone).toBeTruthy();
    expect(shop.websiteUrl).toBeTruthy();
    expect(shop.shippingMethods.length).toBeGreaterThan(0);
    expect(shop.equipment.length).toBeGreaterThan(0);
    expect(shop.capabilitySheets.length).toBeGreaterThan(0);
    expect(shop.capabilitySheets[0]?.parameters.length).toBeGreaterThan(0);
    expect(shop.articles.length).toBeGreaterThan(0);
    // A rejected article carries the reason it was sent back, or a shop is told
    // no and left to guess.
    const rejected = shop.articles.find((article) => article.status === 'rejected');
    expect(rejected?.rejectReason).toBeTruthy();
  });

  it('does not erase what a partial edit cannot see', async () => {
    const before = await profile.getShopProfile(SHOP);
    expect(before?.about).toBeTruthy();

    // Exactly what the settings screen sends — no about, no phone, no socials.
    const result = await profile.saveCompany(SHOP, addressOnly);
    expect(result.ok).toBe(true);

    const after = await profile.getShopProfile(SHOP);
    expect(after?.about).toBe(before?.about);
    expect(after?.phone).toBe(before?.phone);
    expect(after?.linkedinUrl).toBe(before?.linkedinUrl);
    expect(after?.shippingMethods).toEqual(before?.shippingMethods);
  });

  it('takes a bare host and refuses one a browser could not open', async () => {
    const good = await profile.saveCompany(SHOP, {
      ...addressOnly,
      websiteUrl: 'precisioncircuit.example',
    });
    expect(good.ok).toBe(true);
    expect((await profile.getShopProfile(SHOP))?.websiteUrl).toBe(
      'https://precisioncircuit.example/',
    );

    const bad = await profile.saveCompany(SHOP, { ...addressOnly, facebookUrl: 'not a link' });
    expect(bad.ok).toBe(false);
    // And the refusal changed nothing.
    expect((await profile.getShopProfile(SHOP))?.websiteUrl).toBe(
      'https://precisioncircuit.example/',
    );
  });

  it('clears a field when it is sent empty, which is how one is removed', async () => {
    const result = await profile.saveCompany(SHOP, { ...addressOnly, twitterUrl: '' });
    expect(result.ok).toBe(true);
    expect((await profile.getShopProfile(SHOP))?.twitterUrl).toBeNull();
  });
});

describe('the floor list', () => {
  it('adds a machine and gives it the next place in the order', async () => {
    const before = await profile.getShopProfile(SHOP);
    const result = await profile.addEquipment(SHOP, {
      name: 'Selective solder',
      quantity: 2,
      note: 'Through-hole, lead-free',
    });
    expect(result.ok).toBe(true);

    const after = await profile.getShopProfile(SHOP);
    expect(after?.equipment.length).toBe((before?.equipment.length ?? 0) + 1);
    expect(after?.equipment.at(-1)?.name).toBe('Selective solder');
    expect(after?.equipment.at(-1)?.quantity).toBe(2);
  });

  it('refuses a machine nobody could read, and writes nothing', async () => {
    const before = await prisma.shopEquipment.count();
    for (const broken of [
      { name: ' ', quantity: 1, note: '' },
      { name: 'Reflow oven', quantity: 0, note: '' },
      { name: 'Reflow oven', quantity: 1.5, note: '' },
      { name: 'Reflow oven', quantity: 1000, note: '' },
    ]) {
      expect((await profile.addEquipment(SHOP, broken)).ok).toBe(false);
    }
    expect(await prisma.shopEquipment.count()).toBe(before);
  });

  it('will not let one shop remove another shop’s machine', async () => {
    const theirs = await prisma.shopEquipment.findFirst({ where: { manufacturerId: OTHER } });
    expect(theirs).not.toBeNull();
    if (theirs === null) return;

    const result = await profile.removeEquipment(SHOP, theirs.id);
    expect(result.ok).toBe(false);
    expect(await prisma.shopEquipment.findUnique({ where: { id: theirs.id } })).not.toBeNull();
  });

  it('removes its own', async () => {
    const mine = await prisma.shopEquipment.findFirst({ where: { manufacturerId: SHOP } });
    expect(mine).not.toBeNull();
    if (mine === null) return;

    expect((await profile.removeEquipment(SHOP, mine.id)).ok).toBe(true);
    expect(await prisma.shopEquipment.findUnique({ where: { id: mine.id } })).toBeNull();
  });
});
