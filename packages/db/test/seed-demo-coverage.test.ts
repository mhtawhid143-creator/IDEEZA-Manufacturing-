import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  assertCostLinesExplainUnitPrice,
  availableStock,
  quoteCostKindsFor,
  stockLevelOf,
} from '@ideeza/domain';
import { seedDatabase } from '../prisma/seed.js';
import { startTestDatabase, type TestDatabase } from '../test-support/index.js';

/**
 * The demo database has to show what the platform can do.
 *
 * These are not tests of a rule — every rule here is already pinned in the
 * domain. They test the *seed*, because a reviewer reads the seeded records
 * before any other, and three features were built, tested and then reported
 * missing by a reviewer who had no row to see them on: the printed half of a
 * combined request, a quote's cost breakdown, and the withdrawal history.
 *
 * A feature a reviewer cannot reach has not been delivered. So the seed owes
 * each built surface at least one row, and this file is what says so.
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

describe('the seeded request carries both kinds of work', () => {
  it('is a combined package, so both specification cards have something to show', async () => {
    const pkg = await prisma.manufacturingPackage.findUniqueOrThrow({
      where: { id: 'seed_package_full' },
    });
    expect(pkg.kind).toBe('full_product');
  });

  it('answers the printed questions a printer quotes on', async () => {
    const requirements = await prisma.manufacturingRequirements.findUniqueOrThrow({
      where: { id: 'seed_requirements_v1' },
    });

    // Without these the specification tab shows a board and an empty card
    // beside it, which is what "3d information not displayed" meant.
    expect(requirements.printTechnology).not.toBeNull();
    expect(requirements.printMaterial).not.toBeNull();
    expect(requirements.surfaceFinish).not.toBeNull();
  });

  it('answers the board questions too, so the card is not a column of discretion', async () => {
    const spec = await prisma.boardSpecification.findUniqueOrThrow({
      where: { requirementsId: 'seed_requirements_v1' },
    });

    // "Manufacturer's discretion" on every row is a truthful rendering of
    // nothing, and it reads on screen as a screen that failed to load.
    expect(spec.baseMaterial).not.toBeNull();
    expect(spec.layerCount).not.toBeNull();
    expect(spec.surfaceFinish).not.toBeNull();
    expect(spec.workmanshipClass).not.toBeNull();
  });

  it('has a print specification with a whole bounding box', async () => {
    const spec = await prisma.printSpecification.findUniqueOrThrow({
      where: { requirementsId: 'seed_requirements_v1' },
    });

    // Three axes or none — a half-answered box is refused by the domain and by
    // a database constraint, and it is the Dimensions row a reviewer looked for.
    expect(spec.dimensionXMm).not.toBeNull();
    expect(spec.dimensionYMm).not.toBeNull();
    expect(spec.dimensionZMm).not.toBeNull();
    expect(spec.layerHeightMm).not.toBeNull();
    expect(spec.toleranceMm).not.toBeNull();
  });
});

describe('the seeded quotes are itemised', () => {
  it('gives both quotes a breakdown that adds up to the unit price', async () => {
    const quotes = await prisma.quote.findMany({
      where: { id: { in: ['seed_quote_a', 'seed_quote_b'] } },
      include: { costLines: true },
      orderBy: { id: 'asc' },
    });
    expect(quotes).toHaveLength(2);

    const allowed = quoteCostKindsFor({
      packageKind: 'full_product',
      assemblyAsked: true,
      hardwareAsked: false,
    });

    for (const quote of quotes) {
      expect(quote.costLines.length).toBeGreaterThan(0);

      // The same invariant the submit path runs. If the seed ever drifts, this
      // fails here rather than on a reviewer's screen.
      assertCostLinesExplainUnitPrice({
        unitPriceMinor: Number(quote.unitPriceMinor),
        lines: quote.costLines.map((line) => ({
          kind: line.kind,
          amountMinor: Number(line.amountMinor),
        })),
        allowed,
      });
    }
  });

  it('spends on both families, so the per-type subtotals both appear', async () => {
    const lines = await prisma.quoteCostLine.findMany({ where: { quoteId: 'seed_quote_a' } });
    const kinds = new Set(lines.map((line) => line.kind));

    expect(kinds.has('fabrication')).toBe(true);
    expect(kinds.has('material')).toBe(true);
  });
});

/**
 * UIUX-219. The rule — a full shelf with everything promised is out of stock,
 * because what is promised cannot be promised again — was right and tested, and
 * the demo database had no part in that state for anyone to see it in. So the
 * one row that proves the rule was the one row nobody could find.
 */
describe('a part whose shelf is full and whose stock is all spoken for', () => {
  it('is seeded, and reads as out of stock rather than as stock', async () => {
    const part = await prisma.inventoryItem.findFirstOrThrow({
      where: { manufacturerId: 'seed_mfr_a', sku: 'CAP-100U25V' },
    });

    expect(part.stockQuantity).toBeGreaterThan(0);
    expect(part.reservedQuantity).toBe(part.stockQuantity);
    expect(stockLevelOf(part)).toBe('out_of_stock');
    expect(availableStock(part)).toBe(0);
  });
});

describe('the shop has a withdrawal history', () => {
  it('seeds one of each outcome, so the history dialog is not an empty state', async () => {
    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { manufacturerId: 'seed_mfr_a' },
    });
    const statuses = withdrawals.map((row) => row.status).sort();

    expect(statuses).toEqual(['paid', 'rejected', 'requested']);
  });
});
