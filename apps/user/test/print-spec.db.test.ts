import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { InvariantViolationError, asId, type RfqId, type UserId } from '@ideeza/domain';
import type { SaveDraftInput } from '@ideeza/types';
import type * as DraftData from '../src/data/drafts.js';
import type * as PrintSpecData from '../src/data/print-spec.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

/**
 * UIUX-153 (MFG-49). The printed part's own specification, written and read the
 * way the board's is: it belongs to the request's requirements, it is frozen
 * when the request goes out, and only the buyer who owns the draft may touch it.
 */
let database: TestDatabase;
let prisma: PrismaClient;
let drafts: typeof DraftData;
let spec: typeof PrintSpecData;

const BUYER = asId<UserId>('seed_user_buyer');
const OTHER = asId<UserId>('seed_user_creator_a');

const printedDraft = (overrides: Partial<SaveDraftInput> = {}): SaveDraftInput => ({
  productId: 'seed_product_sensor_hub',
  kind: 'module_3d',
  includedFileIds: ['seed_file_sensor_step'],
  includedBomLineIds: [],
  quantity: 25,
  material: 'PA12 nylon',
  manufacturingMethod: 'SLS printing',
  tolerance: '+/-0.25mm',
  leadTimeDays: 14,
  shippingRequirement: 'Courier, tracked',
  assembly: 'none',
  qualityCheckRequirement: 'Dimensional check on 10%',
  substitutionPolicy: 'with_approval',
  printTechnology: 'sls',
  printMaterial: 'PA12',
  deliveryAddress: { line1: '20/3, Sector 9', city: 'Dhaka', countryCode: 'BD' },
  ...overrides,
});

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  drafts = await import('../src/data/drafts.js');
  spec = await import('../src/data/print-spec.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('the print specification of a draft', () => {
  it('is written to the requirements and read back as a document', async () => {
    const rfqId = await drafts.createDraft(BUYER, printedDraft());

    await spec.savePrintSpec(BUYER, {
      draftId: rfqId,
      layerHeightMm: 0.12,
      wallThicknessMm: 2,
      dimensionXMm: 118.4,
      dimensionYMm: 96.25,
      dimensionZMm: 47,
      toleranceMm: 0.25,
      supportStructure: 'none',
      orientationRequirement: 'Print the bearing seat vertically.',
      postProcessing: 'Bead blast, then dye black.',
      certification: 'RoHS',
    });

    const view = await spec.getPrintSpec(BUYER, asId<RfqId>(rfqId));
    expect(view?.hasPrintedPart).toBe(true);
    expect(view?.spec.layerHeightMm).toBe(0.12);
    expect(view?.spec.dimensionYMm).toBe(96.25);

    const rows = spec.printSpecRows(view!);
    const value = (label: string): string | undefined =>
      rows.find((row) => row.label === label)?.value;
    // The five answers on the requirements and the depth beside them, read as
    // one document — which is the whole point of the section.
    expect(value('Print process')).toBe('SLS (powder)');
    expect(value('Material')).toBe('PA12');
    expect(value('Layer height')).toBe('0.12mm');
    expect(value('Dimensions')).toBe('118.4 × 96.25 × 47 mm');
  });

  it('is nobody else’s to read or to write', async () => {
    const rfqId = await drafts.createDraft(BUYER, printedDraft());

    expect(await spec.getPrintSpec(OTHER, asId<RfqId>(rfqId))).toBeNull();
    await expect(
      spec.savePrintSpec(OTHER, { draftId: rfqId, layerHeightMm: 0.2 }),
    ).rejects.toThrow(/does not exist/);
  });

  it('refuses a specification a shop could not build to', async () => {
    const rfqId = await drafts.createDraft(BUYER, printedDraft());

    // A tolerance finer than the layer it is built from is a wish, not a spec.
    await expect(
      spec.savePrintSpec(BUYER, {
        draftId: rfqId,
        layerHeightMm: 0.2,
        toleranceMm: 0.05,
      }),
    ).rejects.toThrow(InvariantViolationError);

    // And a box with one axis missing describes nothing.
    await expect(
      spec.savePrintSpec(BUYER, {
        draftId: rfqId,
        dimensionXMm: 70,
        dimensionYMm: 70,
      }),
    ).rejects.toThrow(/all three/);
  });

  it('does not apply to a package with nothing printed in it', async () => {
    const rfqId = await drafts.createDraft(
      BUYER,
      printedDraft({
        productId: 'seed_product_fpv_stack',
        kind: 'pcb',
        includedFileIds: ['seed_file_stack_gerber'],
        includedBomLineIds: ['seed_bom_stack_u1'],
        assembly: 'smt',
      }),
    );

    const view = await spec.getPrintSpec(BUYER, asId<RfqId>(rfqId));
    expect(view?.hasPrintedPart).toBe(false);
    await expect(
      spec.savePrintSpec(BUYER, { draftId: rfqId, layerHeightMm: 0.2 }),
    ).rejects.toThrow(/no printed part in it/);
  });

  it('reads as the manufacturer’s decision where the buyer said nothing', async () => {
    const rfqId = await drafts.createDraft(BUYER, printedDraft());

    const view = await spec.getPrintSpec(BUYER, asId<RfqId>(rfqId));
    const rows = spec.printSpecRows(view!);
    // The draft carries a process and a material, so those two are answered and
    // the depth beneath them is not — which is exactly what an untouched
    // specification should say.
    expect(rows.find((row) => row.label === 'Layer height')?.value).toBe(
      "Manufacturer's discretion",
    );
    expect(rows.find((row) => row.label === 'Print process')?.value).toBe('SLS (powder)');
  });
});
