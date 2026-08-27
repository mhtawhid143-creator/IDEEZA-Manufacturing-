import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { InvariantViolationError, asId, type RfqId, type UserId } from '@ideeza/domain';
import type { SaveDraftInput } from '@ideeza/types';
import type * as DraftData from '../src/data/drafts.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

let database: TestDatabase;
let prisma: PrismaClient;
let drafts: typeof DraftData;

const BUYER = asId<UserId>('seed_user_buyer');
const OTHER_BUYER = asId<UserId>('seed_user_creator_a');

const input = (overrides: Partial<SaveDraftInput> = {}): SaveDraftInput => ({
  productId: 'seed_product_fpv_stack',
  kind: 'pcb',
  includedFileIds: ['seed_file_stack_gerber', 'seed_file_stack_bom'],
  includedBomLineIds: ['seed_bom_stack_u1'],
  quantity: 100,
  material: 'FR-4 TG150',
  manufacturingMethod: 'PCB fabrication + SMT assembly',
  tolerance: 'Board outline +/-0.15mm',
  leadTimeDays: 21,
  shippingRequirement: 'Courier, tracked',
  assembly: 'smt',
  qualityCheckRequirement: 'Optical inspection on 100%',
  substitutionPolicy: 'with_approval',
  deliveryAddress: { line1: '20/3, Sector 9', city: 'Dhaka', countryCode: 'BD' },
  ...overrides,
});

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  // Imported after DATABASE_URL is set, because the data layer builds its
  // client from the environment.
  drafts = await import('../src/data/drafts.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('the draft a buyer prepares', () => {
  it('creates the package, the requirements and the request together', async () => {
    const rfqId = await drafts.createDraft(BUYER, input());

    const row = await prisma.rfq.findUniqueOrThrow({
      where: { id: rfqId },
      include: {
        package: { include: { files: true, bomLines: true } },
        requirements: true,
      },
    });

    expect(row.status).toBe('draft');
    expect(row.buyerId).toBe(BUYER);
    expect(row.quantity).toBe(100);
    expect(row.currency).toBe('USD');
    expect(row.shipToCity).toBe('Dhaka');
    expect(row.submittedAt).toBeNull();
    expect(row.package.kind).toBe('pcb');
    expect(row.package.productId).toBe('seed_product_fpv_stack');
    expect(row.package.files).toHaveLength(2);
    expect(row.package.bomLines).toHaveLength(1);
    expect(row.requirements.lockedAt).toBeNull();
    expect(row.requirements.material).toBe('FR-4 TG150');

    // Nothing is routed by saving a draft.
    expect(await prisma.rfqRecipient.count({ where: { rfqId } })).toBe(0);
  });

  it('refuses a package with no files', async () => {
    await expect(drafts.createDraft(BUYER, input({ includedFileIds: [] }))).rejects.toThrow(
      InvariantViolationError,
    );
  });

  it('refuses a quantity that is not a whole number of units', async () => {
    await expect(drafts.createDraft(BUYER, input({ quantity: 0 }))).rejects.toThrow(
      InvariantViolationError,
    );
    await expect(drafts.createDraft(BUYER, input({ quantity: 2.5 }))).rejects.toThrow(
      InvariantViolationError,
    );
  });

  it('lists only the drafts of the buyer who owns them', async () => {
    const mine = await drafts.listDrafts(BUYER);
    const theirs = await drafts.listDrafts(OTHER_BUYER);

    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((draft) => draft.status === 'draft')).toBe(true);
    expect(theirs).toHaveLength(0);
  });

  it('saves changes and keeps the file selection in step', async () => {
    const rfqId = await drafts.createDraft(
      BUYER,
      input({
        productId: 'seed_product_sensor_hub',
        includedFileIds: ['seed_file_sensor_step'],
        includedBomLineIds: [],
        assembly: 'none',
        printTechnology: 'sls',
        printMaterial: 'PA12',
      }),
    );

    await drafts.updateDraft(
      BUYER,
      rfqId,
      input({
        productId: 'seed_product_sensor_hub',
        includedFileIds: ['seed_file_sensor_step'],
        includedBomLineIds: [],
        kind: 'module_3d',
        quantity: 25,
        material: 'PA12 nylon',
        // A model file with no board: nothing to assemble, and a printer needs
        // to know the process and the material.
        assembly: 'none',
        printTechnology: 'sls',
        printMaterial: 'PA12',
      }),
    );

    const row = await prisma.rfq.findUniqueOrThrow({
      where: { id: rfqId },
      include: { package: { include: { files: true } }, requirements: true },
    });
    expect(row.package.kind).toBe('module_3d');
    expect(row.quantity).toBe(25);
    expect(row.requirements.material).toBe('PA12 nylon');
    expect(row.requirements.printTechnology).toBe('sls');
    expect(row.requirements.printMaterial).toBe('PA12');
    expect(row.package.files.map((link) => link.fileId)).toEqual(['seed_file_sensor_step']);
  });

  it('refuses to edit a request that has already been sent', async () => {
    const sent = await prisma.rfq.findFirstOrThrow({ where: { status: 'closed' } });
    await expect(
      drafts.updateDraft(BUYER, asId<RfqId>(sent.id), input()),
    ).rejects.toThrow(InvariantViolationError);
  });

  it('refuses to touch another buyer’s draft', async () => {
    const mine = await drafts.listDrafts(BUYER);
    const first = mine[0];
    expect(first).toBeDefined();
    await expect(
      drafts.updateDraft(OTHER_BUYER, first?.rfqId ?? asId<RfqId>('missing'), input()),
    ).rejects.toThrow(/does not exist/);
  });

  it('withdraws a draft as a lifecycle step, with an event to show for it', async () => {
    const rfqId = await drafts.createDraft(BUYER, input({ quantity: 7 }));

    await drafts.withdrawDraft(BUYER, rfqId);

    const row = await prisma.rfq.findUniqueOrThrow({ where: { id: rfqId } });
    expect(row.status).toBe('withdrawn');
    expect(row.closedAt).not.toBeNull();

    const events = await prisma.domainEvent.findMany({
      where: { subjectKind: 'rfq', subjectId: rfqId },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('rfq_withdrawn');
    expect(events[0]?.actorRole).toBe('buyer');

    // A withdrawn request no longer blocks the product it came from.
    const open = await drafts.listDrafts(BUYER);
    expect(open.some((draft) => draft.rfqId === rfqId)).toBe(false);
  });

  it('refuses to withdraw twice, because withdrawn is terminal', async () => {
    const rfqId = await drafts.createDraft(BUYER, input({ quantity: 9 }));
    await drafts.withdrawDraft(BUYER, rfqId);
    await expect(drafts.withdrawDraft(BUYER, rfqId)).rejects.toThrow(
      /transition withdrawn -> withdrawn/,
    );
  });
});
