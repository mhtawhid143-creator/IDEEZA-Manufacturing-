import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
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
