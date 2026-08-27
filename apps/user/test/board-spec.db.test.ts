import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { InvariantViolationError, asId, type RfqId, type UserId } from '@ideeza/domain';
import type { SaveDraftInput, SendRequestInput } from '@ideeza/types';
import type * as BoardSpecData from '../src/data/board-spec.js';
import type * as DraftData from '../src/data/drafts.js';
import type * as RequestData from '../src/data/requests.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

let database: TestDatabase;
let prisma: PrismaClient;
let drafts: typeof DraftData;
let requests: typeof RequestData;
let spec: typeof BoardSpecData;

const BUYER = asId<UserId>('seed_user_buyer');
const OTHER = asId<UserId>('seed_user_creator_a');

const boardDraft = (overrides: Partial<SaveDraftInput> = {}): SaveDraftInput => ({
  productId: 'seed_product_fpv_stack',
  kind: 'pcb',
  includedFileIds: ['seed_file_stack_gerber'],
  includedBomLineIds: ['seed_bom_stack_u1'],
  quantity: 100,
  material: 'FR-4 TG150',
  manufacturingMethod: 'PCB fabrication + SMT assembly',
  tolerance: '+/-0.15mm',
  leadTimeDays: 21,
  shippingRequirement: 'Courier, tracked',
  assembly: 'smt',
  qualityCheckRequirement: 'AOI on 100%',
  substitutionPolicy: 'with_approval',
  deliveryAddress: { line1: '20/3, Sector 9', city: 'Dhaka', countryCode: 'BD' },
  ...overrides,
});

const emptyInput = (draftId: string) => ({
  draftId,
  goldFingers: false,
  castellatedHoles: false,
  edgePlating: false,
  blindOrBuriedVias: false,
  conformalCoating: false,
  functionalTest: false,
  stencilRequired: false,
});

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  drafts = await import('../src/data/drafts.js');
  requests = await import('../src/data/requests.js');
  spec = await import('../src/data/board-spec.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('the board specification of a draft', () => {
  it('starts open, and says so', async () => {
    const draftId = await drafts.createDraft(BUYER, boardDraft({ quantity: 400 }));
    const view = await spec.getBoardSpec(BUYER, draftId);

    expect(view?.hasBoard).toBe(true);
    expect(view?.editable).toBe(true);
    expect(view?.specifiedCount).toBe(0);
    expect(view?.spec.layerCount).toBeNull();

    const rows = spec.boardSpecRows(view!);
    expect(rows.find((row) => row.label === 'Layers')?.value).toBe(
      "Manufacturer's discretion",
    );
  });

  it('saves what the buyer pinned down and leaves the rest open', async () => {
    const draftId = await drafts.createDraft(BUYER, boardDraft({ quantity: 401 }));
    await spec.saveBoardSpec(BUYER, {
      ...emptyInput(String(draftId)),
      baseMaterial: 'fr4',
      layerCount: 4,
      thicknessMm: 1.6,
      surfaceFinish: 'enig',
      boardColor: 'black',
      outerCopperOz: 1,
      innerCopperOz: 1,
      electricalTest: 'flying_probe_full',
      workmanshipClass: 'ipc_class_3',
      partsSuppliedBy: 'buyer',
      remarks: 'Impedance control on the differential pairs.',
    });

    const view = await spec.getBoardSpec(BUYER, draftId);
    expect(view?.spec.layerCount).toBe(4);
    expect(view?.spec.thicknessMm).toBe(1.6);
    expect(view?.spec.surfaceFinish).toBe('enig');
    expect(view?.spec.viaCovering).toBeNull();
    expect(view?.specifiedCount).toBeGreaterThan(8);

    const rows = spec.boardSpecRows(view!);
    expect(rows.find((row) => row.label === 'Via covering')?.value).toBe(
      "Manufacturer's discretion",
    );
    expect(rows.find((row) => row.label === 'Remarks')?.value).toMatch(/Impedance/);
  });

  it('refuses a specification the design cannot hold', async () => {
    const draftId = await drafts.createDraft(BUYER, boardDraft({ quantity: 402 }));
    await expect(
      spec.saveBoardSpec(BUYER, {
        ...emptyInput(String(draftId)),
        layerCount: 2,
        blindOrBuriedVias: true,
      }),
    ).rejects.toThrow(InvariantViolationError);
  });

  it('refuses a stencil on a request the manufacturer is assembling', async () => {
    const draftId = await drafts.createDraft(BUYER, boardDraft({ quantity: 403 }));
    await expect(
      spec.saveBoardSpec(BUYER, {
        ...emptyInput(String(draftId)),
        stencilRequired: true,
      }),
    ).rejects.toThrow(/populating the board yourself/);
  });

  it('has nothing to describe when the package is printed parts only', async () => {
    const draftId = await drafts.createDraft(
      BUYER,
      boardDraft({
        productId: 'seed_product_sensor_hub',
        includedFileIds: ['seed_file_sensor_step'],
        includedBomLineIds: [],
        quantity: 404,
        assembly: 'none',
        printTechnology: 'sls',
        printMaterial: 'PA12',
      }),
    );

    const view = await spec.getBoardSpec(BUYER, draftId);
    expect(view?.hasBoard).toBe(false);
    await expect(
      spec.saveBoardSpec(BUYER, emptyInput(String(draftId))),
    ).rejects.toThrow(/no board in it/);
  });

  it('shows another buyer nothing', async () => {
    const draftId = await drafts.createDraft(BUYER, boardDraft({ quantity: 405 }));
    expect(await spec.getBoardSpec(OTHER, draftId)).toBeNull();
  });
});

describe('once the request has gone out', () => {
  const sendInput = (rfqId: string, quantity: number): SendRequestInput => ({
    rfqId,
    requestedServices: ['pcb_fabrication', 'pcb_assembly'],
    manufacturerIds: ['seed_mfr_a'],
    quantity,
    assembly: 'smt',
    volumeTiers: [],
    deliveryAddress: { line1: '20/3, Sector 9', city: 'Dhaka', countryCode: 'BD' },
  });

  it('locks the specification and says why', async () => {
    const draftId = await drafts.createDraft(BUYER, boardDraft({ quantity: 406 }));
    await spec.saveBoardSpec(BUYER, {
      ...emptyInput(String(draftId)),
      layerCount: 4,
      surfaceFinish: 'enig',
    });
    await requests.submitRequest(BUYER, sendInput(String(draftId), 406));

    const view = await spec.getBoardSpec(BUYER, asId<RfqId>(String(draftId)));
    expect(view?.editable).toBe(false);
    expect(view?.lockedReason).not.toBeNull();
    // The document itself is still readable: it is what the quotes answer.
    expect(view?.spec.layerCount).toBe(4);

    await expect(
      spec.saveBoardSpec(BUYER, { ...emptyInput(String(draftId)), layerCount: 6 }),
    ).rejects.toThrow(InvariantViolationError);
  });

  it('refuses to send a request whose specification contradicts it', async () => {
    const draftId = await drafts.createDraft(BUYER, boardDraft({ quantity: 407 }));
    await spec.saveBoardSpec(BUYER, {
      ...emptyInput(String(draftId)),
      partsSuppliedBy: 'manufacturer',
    });

    await expect(
      requests.submitRequest(BUYER, sendInput(String(draftId), 407)),
    ).rejects.toThrow(/parts sourcing has to be quoted/);

    await requests.submitRequest(BUYER, {
      ...sendInput(String(draftId), 407),
      requestedServices: ['pcb_fabrication', 'pcb_assembly', 'parts_sourcing'],
    });
  });
});
