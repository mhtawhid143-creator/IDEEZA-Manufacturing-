import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  QUOTE_COST_FAMILY,
  QUOTE_COST_FAMILY_LABEL,
  QUOTE_COST_KINDS,
  QUOTE_COST_LABEL,
  assertCostLinesExplainUnitPrice,
  quoteCostKindsFor,
} from '../src/index.js';

const BOARD_WITH_ASSEMBLY = {
  packageKind: 'pcb' as const,
  assemblyAsked: true,
  hardwareAsked: false,
};

describe('which cost lines a request can be priced with', () => {
  it('offers no stencil on a board nobody asked to have assembled', () => {
    // A stencil is only cut for placing parts. Offering the line on a
    // fabrication-only board invites a number that means nothing.
    const fabOnly = quoteCostKindsFor({
      packageKind: 'pcb',
      assemblyAsked: false,
      hardwareAsked: false,
    });
    expect(fabOnly).toEqual(['fabrication', 'parts']);
    expect(quoteCostKindsFor(BOARD_WITH_ASSEMBLY)).toContain('stencil');
  });

  it('prices a printed part on its own terms, not a board’s', () => {
    const printed = quoteCostKindsFor({
      packageKind: 'module_3d',
      assemblyAsked: false,
      hardwareAsked: false,
    });
    expect(printed).toEqual(['material', 'machine_time', 'support_removal', 'finishing']);
    expect(printed).not.toContain('fabrication');
  });

  it('offers both families when the package holds both', () => {
    const both = quoteCostKindsFor({
      packageKind: 'full_product',
      assemblyAsked: true,
      hardwareAsked: true,
    });
    expect(both).toContain('fabrication');
    expect(both).toContain('material');
    expect(both).toContain('hardware');
  });

  it('never offers a shipping line, because that money is counted elsewhere', () => {
    // The courier is the buyer's choice at checkout and the shipping estimate
    // is its own field on the quote, so a per-unit line here would be the same
    // money twice.
    for (const kind of ['pcb', 'module_3d', 'full_product'] as const) {
      expect(
        quoteCostKindsFor({ packageKind: kind, assemblyAsked: true, hardwareAsked: true }),
      ).not.toContain('shipping');
    }
  });
});

describe('which kind of work each cost belongs to', () => {
  it('places every line in exactly one family', () => {
    // The per-type subtotal is a grouping of the lines rather than new data
    // (UIUX-194), which only holds if every line has a family.
    for (const kind of QUOTE_COST_KINDS) {
      expect(['board', 'printed']).toContain(QUOTE_COST_FAMILY[kind]);
    }
  });

  it('keeps the board and printed families apart', () => {
    expect(QUOTE_COST_FAMILY.fabrication).toBe('board');
    expect(QUOTE_COST_FAMILY.stencil).toBe('board');
    expect(QUOTE_COST_FAMILY.material).toBe('printed');
    expect(QUOTE_COST_FAMILY.support_removal).toBe('printed');
  });

  it('names both families in the portal’s own words', () => {
    expect(QUOTE_COST_FAMILY_LABEL.board).toBe('PCB');
    expect(QUOTE_COST_FAMILY_LABEL.printed).toBe('3D printing');
  });

  it('groups a combined package into two subtotals that add to the price', () => {
    const lines = [
      { kind: 'fabrication' as const, amountMinor: 700 },
      { kind: 'parts' as const, amountMinor: 300 },
      { kind: 'material' as const, amountMinor: 150 },
      { kind: 'machine_time' as const, amountMinor: 90 },
    ];
    const board = lines
      .filter((line) => QUOTE_COST_FAMILY[line.kind] === 'board')
      .reduce((sum, line) => sum + line.amountMinor, 0);
    const printed = lines
      .filter((line) => QUOTE_COST_FAMILY[line.kind] === 'printed')
      .reduce((sum, line) => sum + line.amountMinor, 0);
    expect(board).toBe(1_000);
    expect(printed).toBe(240);
    // And the two subtotals are the unit price, so the split cannot introduce
    // a number that disagrees with what the buyer pays.
    expect(() =>
      assertCostLinesExplainUnitPrice({
        unitPriceMinor: board + printed,
        lines,
        allowed: quoteCostKindsFor({
          packageKind: 'full_product',
          assemblyAsked: false,
          hardwareAsked: false,
        }),
      }),
    ).not.toThrow();
  });
});

describe('a breakdown has to explain the price', () => {
  it('accepts a set that adds up to the unit price', () => {
    expect(() =>
      assertCostLinesExplainUnitPrice({
        unitPriceMinor: 1240,
        lines: [
          { kind: 'fabrication', amountMinor: 700 },
          { kind: 'parts', amountMinor: 400 },
          { kind: 'assembly', amountMinor: 120 },
          { kind: 'stencil', amountMinor: 20 },
        ],
        allowed: quoteCostKindsFor(BOARD_WITH_ASSEMBLY),
      }),
    ).not.toThrow();
  });

  it('refuses a set that does not, because the buyer would read two prices', () => {
    expect(() =>
      assertCostLinesExplainUnitPrice({
        unitPriceMinor: 1240,
        lines: [{ kind: 'fabrication', amountMinor: 700 }],
        allowed: quoteCostKindsFor(BOARD_WITH_ASSEMBLY),
      }),
    ).toThrow(InvariantViolationError);
  });

  it('leaves an unexplained price alone', () => {
    // Itemising is an explanation, not a requirement: a shop that prices in its
    // head still has a valid quote.
    expect(() =>
      assertCostLinesExplainUnitPrice({
        unitPriceMinor: 1240,
        lines: [],
        allowed: quoteCostKindsFor(BOARD_WITH_ASSEMBLY),
      }),
    ).not.toThrow();
  });

  it('refuses a line this kind of work cannot carry', () => {
    expect(() =>
      assertCostLinesExplainUnitPrice({
        unitPriceMinor: 500,
        lines: [{ kind: 'material', amountMinor: 500 }],
        allowed: quoteCostKindsFor(BOARD_WITH_ASSEMBLY),
      }),
    ).toThrow(/cannot be priced with a material line/);
  });

  it('refuses a negative line, because a discount is a lower price', () => {
    expect(() =>
      assertCostLinesExplainUnitPrice({
        unitPriceMinor: 500,
        lines: [
          { kind: 'fabrication', amountMinor: 700 },
          { kind: 'parts', amountMinor: -200 },
        ],
        allowed: quoteCostKindsFor(BOARD_WITH_ASSEMBLY),
      }),
    ).toThrow(/cannot be negative/);
  });

  it('names every line it can refuse', () => {
    for (const label of Object.values(QUOTE_COST_LABEL)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
