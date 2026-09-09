import type { PackageKind } from '../entities/product.js';
import { QUOTE_COST_FAMILY_LABEL } from '../invariants/quote-costs.js';
import type { ProductionStageKey } from '../status/index.js';

/**
 * Which kind of work a shop-floor check belongs to (UIUX-206).
 *
 * `either` is not a third kind of work: it is a check on the order as a whole,
 * which a single-kind order still has. Naming it keeps the grouping honest —
 * "Packaging" is not a board step that a printed order happens to share.
 */
export const STAGE_CHECK_FAMILIES = ['board', 'printed', 'either'] as const;

export type StageCheckFamily = (typeof STAGE_CHECK_FAMILIES)[number];

/**
 * The two kinds of work are named in the same words the quote's own breakdown
 * uses, so a shop does not learn one vocabulary for the price and another for
 * the floor.
 */
export const STAGE_CHECK_FAMILY_LABEL: Readonly<Record<StageCheckFamily, string>> =
  Object.freeze({
    board: QUOTE_COST_FAMILY_LABEL.board,
    printed: QUOTE_COST_FAMILY_LABEL.printed,
    either: 'This order',
  });

export interface StageCheck {
  readonly label: string;
  readonly family: StageCheckFamily;
}

export interface StageCheckWork {
  readonly packageKind: PackageKind;
  /** Whether the buyer asked for the parts to be placed, not just the board made. */
  readonly assemblyAsked: boolean;
  /** Whether the printed work is more than one piece, or takes inserts. */
  readonly multiPart: boolean;
}

const BOARD_FABRICATION: readonly string[] = Object.freeze([
  // The gates a bare board actually passes, in the order a fab runs them.
  'Layer stack-up',
  'Copper layer imaging',
  'Drilling',
  'Solder mask',
  'Silkscreen',
  'Surface finish',
]);

const BOARD_ASSEMBLY: readonly string[] = Object.freeze([
  'Solder paste and stencil',
  'Part placement',
  'Reflow',
  'Firmware flashing',
]);

const PRINTED_PRODUCTION: readonly string[] = Object.freeze([
  'Slicing and print preparation',
  'Printing',
  'Support removal',
  'Curing',
  'Post-processing and finishing',
]);

const check =
  (family: StageCheckFamily) =>
  (label: string): StageCheck => ({ label, family });

/**
 * The checks a stage is made of, for this order's kind of work (UIUX-206).
 *
 * Two things this answers that a fixed list could not.
 *
 * First, **the checks belong to the work**. A board order is not asked whether
 * supports came off, and a printed order is not asked about a solder mask. The
 * old fixed template listed "Bare board fabrication" and "Enclosure production"
 * side by side on every order, so half of it was always inapplicable and a shop
 * learned to tick past all of it.
 *
 * Second, **the two families run in parallel**. They are grouped, not
 * sequenced: nothing about imaging copper has to happen before a part is
 * printed, so the checks sit under one stage rather than in a line that
 * pretends one waits for the other. The stages that genuinely wait — quality
 * check, ready to ship — are where the order converges, and they are stages of
 * their own already.
 *
 * The electrical test and the optical inspection are deliberately *not*
 * repeated here: this portal has a quality-check stage of its own, and a check
 * that appears twice can be passed once and read as done in both places.
 */
export const stageChecks = (
  key: ProductionStageKey,
  work: StageCheckWork,
): readonly StageCheck[] => {
  const board = work.packageKind !== 'module_3d';
  const printed = work.packageKind !== 'pcb';
  const either = check('either');

  switch (key) {
    case 'files_under_review':
      return [either('Design file review'), either('Manufacturability review')];

    case 'materials_confirmed':
      return [
        either('Inventory check'),
        ...(board && work.assemblyAsked ? [check('board')('Parts sourcing')] : []),
        ...(printed && work.multiPart
          ? [check('printed')('Insert and hardware sourcing')]
          : []),
        either('Substitution approvals applied'),
      ];

    case 'in_production':
      return [
        ...(board
          ? [
              ...BOARD_FABRICATION.map(check('board')),
              ...(work.assemblyAsked ? BOARD_ASSEMBLY.map(check('board')) : []),
            ]
          : []),
        ...(printed ? PRINTED_PRODUCTION.map(check('printed')) : []),
      ];

    case 'quality_check':
      return [
        ...(board
          ? [check('board')('Optical inspection'), check('board')('Electrical test')]
          : []),
        ...(printed
          ? [
              check('printed')('Dimensional inspection'),
              check('printed')('Finish inspection'),
            ]
          : []),
        either('Functional test'),
      ];

    case 'ready_to_ship':
      return [either('Packaging'), either('Shipping documents')];

    default:
      // The rest are records of something that happened elsewhere — a payment
      // securing, a courier scanning — and have no shop-floor step under them.
      return [];
  }
};

/**
 * The checks grouped by the kind of work, for reading rather than for writing.
 *
 * Only the families this order actually has appear, and a single-kind order
 * gets one group — so the heading is information rather than furniture.
 */
export const stageChecksByFamily = (
  checks: readonly StageCheck[],
): readonly { readonly family: StageCheckFamily; readonly labels: readonly string[] }[] =>
  STAGE_CHECK_FAMILIES.flatMap((family) => {
    const labels = checks.filter((entry) => entry.family === family).map((e) => e.label);
    return labels.length === 0 ? [] : [{ family, labels }];
  });
