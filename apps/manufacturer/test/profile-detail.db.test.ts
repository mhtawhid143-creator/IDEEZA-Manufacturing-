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
/** Shop B has no capability sheet of its own; the print shop does. */
const OTHER_SHEET_SHOP = asId<ManufacturerId>('seed_mfr_c');

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
    expect(shop.machines.length).toBeGreaterThan(0);
    expect(shop.capabilitySheets.length).toBeGreaterThan(0);
    expect(shop.capabilitySheets[0]?.parameters.length).toBeGreaterThan(0);
    expect(shop.capabilitySheets[0]?.kind).toBeTruthy();
    expect(shop.capabilitySheets[0]?.verification).toBe('verified');
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
  const selectiveSolder = {
    name: 'Selective solder',
    process: 'PCB Assembly',
    subProcesses: ['Hand solder', 'Wave solder', '  '],
    tolerance: 'plus or minus 0.1 mm',
    turnaroundTime: '3-7 Days',
  };

  it('adds a machine with everything the card shows', async () => {
    const before = await profile.getShopProfile(SHOP);
    expect((await profile.addMachine(SHOP, selectiveSolder)).ok).toBe(true);

    const after = await profile.getShopProfile(SHOP);
    expect(after?.machines.length).toBe((before?.machines.length ?? 0) + 1);
    const added = after?.machines.at(-1);
    expect(added?.name).toBe('Selective solder');
    expect(added?.process).toBe('PCB Assembly');
    // The blank one is dropped rather than stored: an empty chip on the card
    // is a sub-process a buyer cannot read.
    expect(added?.subProcesses).toEqual(['Hand solder', 'Wave solder']);
    expect(added?.tolerance).toBe('plus or minus 0.1 mm');
    expect(added?.turnaroundTime).toBe('3-7 Days');
  });

  it('refuses a machine a buyer could not act on, and writes nothing', async () => {
    const before = await prisma.shopMachine.count();
    for (const broken of [
      { ...selectiveSolder, name: ' ' },
      { ...selectiveSolder, process: '' },
    ]) {
      expect((await profile.addMachine(SHOP, broken)).ok).toBe(false);
    }
    expect(await prisma.shopMachine.count()).toBe(before);
  });

  it('edits its own in place', async () => {
    const mine = await prisma.shopMachine.findFirst({
      where: { manufacturerId: SHOP, name: 'Selective solder' },
    });
    expect(mine).not.toBeNull();
    if (mine === null) return;

    const result = await profile.updateMachine(SHOP, mine.id, {
      ...selectiveSolder,
      turnaroundTime: '1-2 Days',
    });
    expect(result.ok).toBe(true);
    expect((await prisma.shopMachine.findUnique({ where: { id: mine.id } }))?.turnaroundTime).toBe(
      '1-2 Days',
    );
  });

  it('will not let one shop edit or remove another shop’s machine', async () => {
    const theirs = await prisma.shopMachine.findFirst({ where: { manufacturerId: OTHER } });
    expect(theirs).not.toBeNull();
    if (theirs === null) return;

    expect((await profile.updateMachine(SHOP, theirs.id, selectiveSolder)).ok).toBe(false);
    expect((await profile.removeMachine(SHOP, theirs.id)).ok).toBe(false);

    const still = await prisma.shopMachine.findUnique({ where: { id: theirs.id } });
    expect(still?.name).toBe(theirs.name);
    expect(still?.process).toBe(theirs.process);
  });

  it('removes its own', async () => {
    const mine = await prisma.shopMachine.findFirst({
      where: { manufacturerId: SHOP, name: 'Selective solder' },
    });
    expect(mine).not.toBeNull();
    if (mine === null) return;

    expect((await profile.removeMachine(SHOP, mine.id)).ok).toBe(true);
    expect(await prisma.shopMachine.findUnique({ where: { id: mine.id } })).toBeNull();
  });
});

describe('the capability sheets', () => {
  const cnc = {
    kind: 'cnc_machining',
    title: 'CNC Machining',
    parameters: [
      { label: 'Axis', values: ['3-Axis', '5-Axis'] },
      { label: 'Material', values: ['Aluminium 6061'] },
      { label: 'Tolerance', values: ['plus or minus 0.05mm'] },
      // An answered-nothing row: the form always sends every field, and a row
      // the shop left blank must not become an empty line on the card.
      { label: 'Finish', values: ['  '] },
      { label: 'Build time', values: ['7-10 business days'] },
    ],
    attachmentNames: ['cnc-capability.pdf', '  '],
  };

  it('publishes a sheet, keeps its order, and drops the rows left blank', async () => {
    const before = await profile.getShopProfile(SHOP);
    expect((await profile.addCapabilitySheet(SHOP, cnc)).ok).toBe(true);

    const after = await profile.getShopProfile(SHOP);
    expect(after?.capabilitySheets.length).toBe((before?.capabilitySheets.length ?? 0) + 1);

    const added = after?.capabilitySheets.find((entry) => entry.kind === 'cnc_machining');
    expect(added?.title).toBe('CNC Machining');
    expect(added?.parameters.map((row) => row.label)).toEqual([
      'Axis',
      'Material',
      'Tolerance',
      'Build time',
    ]);
    expect(added?.parameters[0]?.values).toEqual(['3-Axis', '5-Axis']);
    expect(added?.attachmentNames).toEqual(['cnc-capability.pdf']);
    // Nobody at IDEEZA has read it, so it does not claim they have.
    expect(added?.verification).toBe('pending');
  });

  it('refuses a second sheet for the same kind of work', async () => {
    const result = await profile.addCapabilitySheet(SHOP, cnc);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('CNC Machining');
    expect(
      await prisma.shopCapabilitySheet.count({
        where: { manufacturerId: SHOP, kind: 'cnc_machining' },
      }),
    ).toBe(1);
  });

  it('refuses a sheet with nothing answered, and writes nothing', async () => {
    const before = await prisma.shopCapabilitySheet.count();
    const result = await profile.addCapabilitySheet(SHOP, {
      kind: 'injection_moulding',
      title: 'Injection Molding',
      parameters: [{ label: 'Material', values: ['   '] }],
      attachmentNames: [],
    });
    expect(result.ok).toBe(false);
    expect(await prisma.shopCapabilitySheet.count()).toBe(before);
  });

  it('rewrites one, replacing its rows and taking it back to pending', async () => {
    const verified = await prisma.shopCapabilitySheet.findFirst({
      where: { manufacturerId: SHOP, kind: 'pcb_fabrication' },
    });
    expect(verified?.verification).toBe('verified');
    if (verified === null) return;

    const result = await profile.updateCapabilitySheet(SHOP, verified.id, {
      kind: 'pcb_fabrication',
      title: 'PCB Manufacturing',
      parameters: [
        { label: 'Layer support', values: ['20+ layers'] },
        { label: 'Build time', values: ['12-24 Hours'] },
      ],
      attachmentNames: [],
    });
    expect(result.ok).toBe(true);

    const after = (await profile.getShopProfile(SHOP))?.capabilitySheets.find(
      (entry) => entry.kind === 'pcb_fabrication',
    );
    expect(after?.parameters.map((row) => row.label)).toEqual(['Layer support', 'Build time']);
    // The answers IDEEZA read are not the answers on the card any more.
    expect(after?.verification).toBe('pending');
  });

  it('will not let one shop rewrite or remove another shop’s sheet', async () => {
    const theirs = await prisma.shopCapabilitySheet.findFirst({
      where: { manufacturerId: OTHER_SHEET_SHOP },
    });
    expect(theirs).not.toBeNull();
    if (theirs === null) return;

    const rewrite = await profile.updateCapabilitySheet(SHOP, theirs.id, {
      kind: theirs.kind,
      title: 'Mine now',
      parameters: [{ label: 'Build time', values: ['1 hour'] }],
      attachmentNames: [],
    });
    expect(rewrite.ok).toBe(false);
    expect((await profile.removeCapabilitySheet(SHOP, theirs.id)).ok).toBe(false);
    expect(
      (await prisma.shopCapabilitySheet.findUnique({ where: { id: theirs.id } }))?.title,
    ).toBe(theirs.title);
  });

  it('takes its own down, and the rows with it', async () => {
    const mine = await prisma.shopCapabilitySheet.findFirst({
      where: { manufacturerId: SHOP, kind: 'cnc_machining' },
    });
    expect(mine).not.toBeNull();
    if (mine === null) return;

    expect((await profile.removeCapabilitySheet(SHOP, mine.id)).ok).toBe(true);
    expect(await prisma.shopCapabilitySheet.findUnique({ where: { id: mine.id } })).toBeNull();
    expect(await prisma.shopCapabilityParameter.count({ where: { sheetId: mine.id } })).toBe(0);
  });
});
