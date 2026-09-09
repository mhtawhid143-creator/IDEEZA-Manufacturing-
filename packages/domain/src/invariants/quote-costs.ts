import { InvariantViolationError } from '../errors.js';
import type { PackageKind } from '../entities/product.js';

/**
 * What a unit's price is made of (UIUX-166).
 *
 * A manufacturing price is never one number, and the two kinds of work have
 * almost nothing in common — a board has no infill and a printed part has no
 * stencil — so the lines are two families plus one they share. Recording them
 * lets the buyer see what they are paying for, and stops a shop underquoting a
 * cost it forgot existed, which is what the stencil line is really for.
 */
export const QUOTE_COST_KINDS = [
  'fabrication',
  'parts',
  'assembly',
  'stencil',
  'material',
  'machine_time',
  'support_removal',
  'finishing',
  'hardware',
  'shipping',
] as const;

export type QuoteCostKind = (typeof QUOTE_COST_KINDS)[number];

export const QUOTE_COST_LABEL: Readonly<Record<QuoteCostKind, string>> = Object.freeze({
  fabrication: 'Board fabrication',
  parts: 'Components',
  assembly: 'Assembly',
  stencil: 'Stencil',
  material: 'Material',
  machine_time: 'Machine time',
  support_removal: 'Support removal',
  finishing: 'Finishing',
  hardware: 'Hardware and inserts',
  shipping: 'Shipping',
});

/**
 * Which kind of work each cost line belongs to (UIUX-194).
 *
 * A mixed request has two disciplines with nothing in common, and one flat
 * total hides which of them the money is going to. Since the lines are already
 * named per family, the split is a grouping rather than new data — so a shop
 * that itemised gets the per-type subtotal for free, and one that did not is
 * not asked to itemise twice.
 */
export const QUOTE_COST_FAMILY: Readonly<Record<QuoteCostKind, 'board' | 'printed'>> =
  Object.freeze({
    fabrication: 'board',
    parts: 'board',
    assembly: 'board',
    stencil: 'board',
    material: 'printed',
    machine_time: 'printed',
    support_removal: 'printed',
    finishing: 'printed',
    hardware: 'printed',
    // Shared, and never offered as a per-unit line — see `quoteCostKindsFor`.
    shipping: 'board',
  });

export const QUOTE_COST_FAMILY_LABEL: Readonly<Record<'board' | 'printed', string>> =
  Object.freeze({ board: 'PCB', printed: '3D printing' });

export interface QuoteCostWork {
  readonly packageKind: PackageKind;
  /** Whether the buyer asked for the parts to be placed, not just the board made. */
  readonly assemblyAsked: boolean;
  /** Whether the printed work is more than one piece, or takes inserts. */
  readonly hardwareAsked: boolean;
}

/**
 * Which lines this request can actually be priced with.
 *
 * The same conditional rule the production files follow: a fabrication-only
 * board is never asked for a stencil, and a single printed piece is never asked
 * for a hardware line. Offering a line that cannot apply invites a number that
 * means nothing, and a shop that fills it in has mispriced the job.
 *
 * `shipping` is deliberately absent: the courier is the buyer's choice at
 * checkout and the shipping estimate is its own field on the quote, so a
 * per-unit shipping line here would be the same money counted twice.
 */
export const quoteCostKindsFor = (work: QuoteCostWork): readonly QuoteCostKind[] => {
  const board: QuoteCostKind[] = ['fabrication', 'parts'];
  if (work.assemblyAsked) board.push('assembly', 'stencil');
  const printed: QuoteCostKind[] = ['material', 'machine_time', 'support_removal', 'finishing'];
  if (work.hardwareAsked) printed.push('hardware');

  if (work.packageKind === 'pcb') return board;
  if (work.packageKind === 'module_3d') return printed;
  return [...board, ...printed];
};

export interface QuoteCostLine {
  readonly kind: QuoteCostKind;
  readonly amountMinor: number;
}

/**
 * The itemisation has to be an itemisation.
 *
 * There is one authoritative unit price on a quote. These lines say what it is
 * made of, so a set that does not add up to it is not a breakdown — it is a
 * second price, and the buyer would be reading two different numbers for the
 * same thing. A shop that has not itemised at all is allowed: the breakdown is
 * an explanation, not a requirement, and a quote with no lines is simply
 * unexplained rather than wrong.
 */
export const assertCostLinesExplainUnitPrice = (input: {
  readonly unitPriceMinor: number;
  readonly lines: readonly QuoteCostLine[];
  readonly allowed: readonly QuoteCostKind[];
}): void => {
  if (input.lines.length === 0) return;

  for (const line of input.lines) {
    if (line.amountMinor < 0) {
      throw new InvariantViolationError(
        'quote cost lines',
        `the ${QUOTE_COST_LABEL[line.kind].toLowerCase()} line cannot be negative`,
      );
    }
    if (!input.allowed.includes(line.kind)) {
      throw new InvariantViolationError(
        'quote cost lines',
        `this request cannot be priced with a ${QUOTE_COST_LABEL[
          line.kind
        ].toLowerCase()} line`,
      );
    }
  }

  const seen = new Set(input.lines.map((line) => line.kind));
  if (seen.size !== input.lines.length) {
    throw new InvariantViolationError('quote cost lines', 'a cost line is named twice');
  }

  const total = input.lines.reduce((sum, line) => sum + line.amountMinor, 0);
  if (total !== input.unitPriceMinor) {
    throw new InvariantViolationError(
      'quote cost lines',
      'the cost lines have to add up to the unit price, because the unit price is what the buyer pays',
    );
  }
};
