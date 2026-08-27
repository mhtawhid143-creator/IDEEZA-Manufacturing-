import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import {
  InvariantViolationError,
  asId,
  type RfqId,
  type UserId,
} from '@ideeza/domain';
import type { SaveDraftInput, SendRequestInput } from '@ideeza/types';
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

const BUYER = asId<UserId>('seed_user_buyer');
const MANUFACTURER_A = 'seed_mfr_a';
const MANUFACTURER_B = 'seed_mfr_b';

const draftInput = (overrides: Partial<SaveDraftInput> = {}): SaveDraftInput => ({
  productId: 'seed_product_fpv_stack',
  kind: 'pcb',
  includedFileIds: ['seed_file_stack_gerber', 'seed_file_stack_bom'],
  includedBomLineIds: ['seed_bom_stack_u1', 'seed_bom_stack_u2'],
  quantity: 200,
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

const sendInput = (
  rfqId: RfqId,
  overrides: Partial<SendRequestInput> = {},
): SendRequestInput => ({
  rfqId,
  requestedServices: ['pcb_fabrication', 'pcb_assembly'],
  manufacturerIds: [MANUFACTURER_A, MANUFACTURER_B],
  quantity: 200,
  assembly: 'smt',
  volumeTiers: [200, 500],
  deliveryAddress: { line1: '20/3, Sector 9', city: 'Dhaka', countryCode: 'BD' },
  ...overrides,
});

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  drafts = await import('../src/data/drafts.js');
  requests = await import('../src/data/requests.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('sending a request', () => {
  it('offers every manufacturer with what it can do', async () => {
    const options = await requests.listManufacturers();

    // Two board houses and one print shop: the platform quotes 3D on its own.
    expect(options).toHaveLength(3);
    const best = options[0];
    expect(best?.displayName).toBe('PrecisionCircuit Co.');
    expect(best?.rating).toBeGreaterThan(4);
    expect(best?.services).toContain('assembly');
    expect(best?.minimumOrderQuantity).toBeGreaterThan(0);
  });

  it('routes one request to two manufacturers, locks the requirements and writes the items', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput());
    const sentAt = new Date('2026-06-01T09:00:00.000Z');

    await requests.submitRequest(
      BUYER,
      sendInput(rfqId, {
        targetPriceMinor: 4_50,
        neededBy: new Date('2026-08-01T00:00:00.000Z'),
        responseDeadline: new Date('2026-06-20T00:00:00.000Z'),
      }),
      sentAt,
    );

    const row = await prisma.rfq.findUniqueOrThrow({
      where: { id: rfqId },
      include: { recipients: true, items: true, requirements: true },
    });

    expect(row.status).toBe('submitted');
    expect(row.submittedAt?.toISOString()).toBe(sentAt.toISOString());
    expect(row.volumeTiers).toEqual([200, 500]);
    expect(row.targetPriceMinor).toBe(450n);
    expect(row.requirements.lockedAt?.toISOString()).toBe(sentAt.toISOString());

    expect(row.recipients).toHaveLength(2);
    expect(row.recipients.every((recipient) => recipient.status === 'routed')).toBe(true);
    expect(
      row.recipients.every(
        (recipient) =>
          recipient.expiresAt?.toISOString() === '2026-06-20T00:00:00.000Z',
      ),
    ).toBe(true);

    // The bill of materials travels as quantities for the whole run.
    expect(row.items).toHaveLength(2);
    expect(row.items.every((item) => item.quantityRequired === 200)).toBe(true);

    const events = await prisma.domainEvent.findMany({
      where: { subjectKind: 'rfq', subjectId: rfqId },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('rfq_submitted');
  });

  it('refuses to send the same request twice', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 15 }));
    await requests.submitRequest(BUYER, sendInput(rfqId));

    await expect(requests.submitRequest(BUYER, sendInput(rfqId))).rejects.toThrow(
      InvariantViolationError,
    );
  });

  it('refuses a request with no recipient', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 16 }));
    await expect(
      requests.submitRequest(BUYER, sendInput(rfqId, { manufacturerIds: [] })),
    ).rejects.toThrow(/at least one manufacturer/);
  });

  it('refuses the same manufacturer twice on one request', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 17 }));
    await expect(
      requests.submitRequest(
        BUYER,
        sendInput(rfqId, { manufacturerIds: [MANUFACTURER_A, MANUFACTURER_A] }),
      ),
    ).rejects.toThrow(/twice/);
  });

  it('refuses a manufacturer that does not exist', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 18 }));
    await expect(
      requests.submitRequest(BUYER, sendInput(rfqId, { manufacturerIds: ['mfr_nope'] })),
    ).rejects.toThrow(/does not exist/);
  });

  it('refuses a response deadline in the past', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 19 }));
    await expect(
      requests.submitRequest(
        BUYER,
        sendInput(rfqId, { responseDeadline: new Date('2020-01-01T00:00:00.000Z') }),
      ),
    ).rejects.toThrow(/already passed/);
  });

  it('leaves nothing behind when a send is refused', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 21 }));
    await expect(
      requests.submitRequest(BUYER, sendInput(rfqId, { volumeTiers: [500, 500] })),
    ).rejects.toThrow(/listed twice/);

    const row = await prisma.rfq.findUniqueOrThrow({
      where: { id: rfqId },
      include: { recipients: true, items: true, requirements: true },
    });
    expect(row.status).toBe('draft');
    expect(row.recipients).toHaveLength(0);
    expect(row.items).toHaveLength(0);
    expect(row.requirements.lockedAt).toBeNull();
  });

  it('refuses to send another buyer’s draft', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 22 }));
    await expect(
      requests.submitRequest(asId<UserId>('seed_user_creator_a'), sendInput(rfqId)),
    ).rejects.toThrow(/does not exist/);
  });

  it('shows a sent request with its recipients, and lists it under requests', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 23 }));
    await requests.submitRequest(BUYER, sendInput(rfqId, { manufacturerIds: [MANUFACTURER_B] }));

    const detail = await requests.getRequest(BUYER, rfqId);
    expect(detail?.status).toBe('submitted');
    expect(detail?.recipients).toHaveLength(1);
    expect(detail?.recipients[0]?.manufacturerName).toBe('Shenzhen Boards');
    expect(detail?.quotedCount).toBe(0);
    expect(detail?.requirementsLockedAt).not.toBeNull();

    const list = await requests.listSubmittedRequests(BUYER);
    expect(list.some((request) => request.rfqId === rfqId)).toBe(true);
    // The reference scenario's closed request is history the buyer can still read.
    expect(list.some((request) => request.rfqId === 'seed_rfq_1')).toBe(true);
  });

  it('keeps a sent request out of the draft list', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 24 }));
    await requests.submitRequest(BUYER, sendInput(rfqId));

    const draftList = await drafts.listDrafts(BUYER);
    expect(draftList.some((draft) => draft.rfqId === rfqId)).toBe(false);
  });
});

describe('the request after it has been sent', () => {
  it('records what the buyer asked to have quoted', async () => {
    // 80 units clears both seeded minimum order quantities (5 and 50).
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 80 }));
    await requests.submitRequest(
      BUYER,
      sendInput(rfqId, {
        requestedServices: ['pcb_fabrication', 'pcb_assembly', 'testing'],
        quantity: 80,
        assembly: 'mixed',
        assemblySides: 'double_side',
        notes: 'ENIG finish, panelised.',
      }),
    );

    const detail = await requests.getRequest(BUYER, rfqId);
    expect(detail?.requestedServices).toEqual([
      'pcb_fabrication',
      'pcb_assembly',
      'testing',
    ]);
    expect(detail?.assemblySides).toBe('double_side');
    expect(detail?.assembly).toBe('mixed');
    expect(detail?.quantity).toBe(80);
    expect(detail?.notes).toBe('ENIG finish, panelised.');
    // The bill of materials was priced for the confirmed quantity.
    const items = await prisma.rfqItem.findMany({ where: { rfqId } });
    expect(items.every((item) => item.quantityRequired === 80)).toBe(true);
  });

  it('refuses a request that names no service', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 41 }));
    await expect(
      requests.submitRequest(BUYER, sendInput(rfqId, { requestedServices: [] })),
    ).rejects.toThrow(/at least one service/);
  });

  it('refuses a service the package cannot carry', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 42 }));
    // The package is board files only, so an enclosure is not in it to quote.
    await expect(
      requests.submitRequest(
        BUYER,
        sendInput(rfqId, { requestedServices: ['enclosure_3d'], quantity: 42 }),
      ),
    ).rejects.toThrow(/cannot be quoted for a pcb package/);
  });

  it('refuses a recipient that cannot build the request at all', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 43 }));
    // Shenzhen Boards publishes fabrication and assembly, but no testing.
    await expect(
      requests.submitRequest(BUYER, {
        ...sendInput(rfqId, { requestedServices: ['testing'], quantity: 43 }),
        manufacturerIds: ['seed_mfr_b'],
      }),
    ).rejects.toThrow(/cannot build this request/);
  });

  it('carries the fit of every manufacturer when the list is read for a request', async () => {
    const options = await requests.listManufacturers({
      requestedServices: ['pcb_fabrication', 'enclosure_3d'],
      quantity: 200,
      leadTimeDays: 21,
    });
    expect(options.every((option) => option.fit !== undefined)).toBe(true);
    // The board house that also prints meets it; the board-only house and the
    // print-only shop each cover part of it.
    expect(options.some((option) => option.fit?.verdict === 'meets')).toBe(true);
    expect(options.some((option) => option.fit?.verdict === 'partial')).toBe(true);

    const tiny = await requests.listManufacturers({
      requestedServices: ['pcb_fabrication'],
      quantity: 1,
      leadTimeDays: 21,
    });
    expect(tiny.some((option) => option.fit?.verdict === 'cannot')).toBe(true);
  });

  it('sends an open request to another manufacturer without unlocking it', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 60 }));
    await requests.submitRequest(
      BUYER,
      sendInput(rfqId, { manufacturerIds: [MANUFACTURER_A], quantity: 60 }),
    );

    const added = await requests.addRecipients(BUYER, rfqId, [MANUFACTURER_B]);
    expect(added).toBe(1);

    const detail = await requests.getRequest(BUYER, rfqId);
    expect(detail?.recipients).toHaveLength(2);
    expect(detail?.status).toBe('submitted');
    expect(detail?.requirementsLockedAt).not.toBeNull();

    // Sending it to the same manufacturer again changes nothing.
    expect(await requests.addRecipients(BUYER, rfqId, [MANUFACTURER_B])).toBe(0);
  });

  it('refuses to add a recipient to a request that is no longer open', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 61 }));
    await requests.submitRequest(BUYER, sendInput(rfqId, { quantity: 61, manufacturerIds: [MANUFACTURER_A] }));
    await requests.withdrawRequest(BUYER, rfqId);

    await expect(requests.addRecipients(BUYER, rfqId, [MANUFACTURER_A])).rejects.toThrow(
      /closed/,
    );
  });

  it('withdraws a sent request and says so in the event log', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 62 }));
    await requests.submitRequest(BUYER, sendInput(rfqId, { quantity: 62, manufacturerIds: [MANUFACTURER_A] }));

    await requests.withdrawRequest(BUYER, rfqId);

    const row = await prisma.rfq.findUniqueOrThrow({ where: { id: rfqId } });
    expect(row.status).toBe('withdrawn');
    expect(row.closedAt).not.toBeNull();

    const events = await prisma.domainEvent.findMany({
      where: { subjectKind: 'rfq', subjectId: rfqId },
      orderBy: { occurredAt: 'asc' },
    });
    expect(events.map((event) => event.kind)).toEqual(['rfq_submitted', 'rfq_withdrawn']);

    // A withdrawn request frees the product for a new one.
    const open = await requests.listSubmittedRequests(BUYER);
    expect(open.some((request) => request.rfqId === rfqId)).toBe(false);
  });

  it('refuses to withdraw a request that belongs to somebody else', async () => {
    const rfqId = await drafts.createDraft(BUYER, draftInput({ quantity: 63 }));
    await requests.submitRequest(BUYER, sendInput(rfqId, { quantity: 63, manufacturerIds: [MANUFACTURER_A] }));
    await expect(
      requests.withdrawRequest(asId<UserId>('seed_user_creator_a'), rfqId),
    ).rejects.toThrow(/does not exist/);
  });
});
