import { InvariantViolationError } from '../errors.js';
import {
  BOARD_THICKNESSES_MM,
  COPPER_WEIGHTS_OZ,
  LAYER_COUNTS,
  MAX_DISTINCT_DESIGNS,
  MIN_VIA_HOLES_MM,
  OUTLINE_TOLERANCES_MM,
  type AssembledFace,
  type BoardPackaging,
  type DeliveryFormat,
  type SuppliedBy,
} from '../status/board.js';
import type { AssemblyMode } from '../entities/product.js';
import type { AssemblySides, QuotedService } from '../status/index.js';
import { includesBoard } from './composition.js';

export interface BoardSpec {
  readonly layerCount?: number | undefined;
  readonly thicknessMm?: number | undefined;
  readonly outerCopperOz?: number | undefined;
  readonly innerCopperOz?: number | undefined;
  readonly minViaHoleMm?: number | undefined;
  readonly outlineToleranceMm?: number | undefined;
  readonly deliveryFormat?: DeliveryFormat | undefined;
  readonly distinctDesigns?: number | undefined;
  readonly blindOrBuriedVias?: boolean | undefined;
  readonly assembledFace?: AssembledFace | undefined;
  readonly partsSuppliedBy?: SuppliedBy | undefined;
  readonly toolingHolesAddedBy?: SuppliedBy | undefined;
  readonly conformalCoating?: boolean | undefined;
  readonly functionalTest?: boolean | undefined;
  readonly stencilRequired?: boolean | undefined;
  readonly packaging?: BoardPackaging | undefined;
}

/** A board specification only means something for a package with a board in it. */
export const assertBoardSpecApplies = (fileNames: readonly string[]): void => {
  if (!includesBoard(fileNames)) {
    throw new InvariantViolationError(
      'board-spec-without-a-board',
      'this package has no board in it, so there is no board specification to edit',
    );
  }
};

const oneOf = (
  value: number | undefined,
  allowed: readonly number[],
  field: string,
): void => {
  if (value === undefined) return;
  if (!allowed.includes(value)) {
    throw new InvariantViolationError(
      'board-spec-value',
      `${field} has to be one of ${allowed.join(', ')}`,
    );
  }
};

/**
 * The rules a board specification has to obey to be buildable.
 *
 * These are the ones a fabricator would send back rather than quote: layers that
 * cannot hold buried vias, a panel count on a single board, assembly answers on
 * a request that asks for no assembly. Everything a shop merely *prefers* is left
 * alone — that is what a quote is for.
 */
export const assertBoardSpecCoherent = (
  spec: BoardSpec,
  requirements: {
    readonly assembly: AssemblyMode;
    readonly assemblySides: AssemblySides | null;
  },
): void => {
  oneOf(spec.layerCount, LAYER_COUNTS, 'the layer count');
  oneOf(spec.thicknessMm, BOARD_THICKNESSES_MM, 'the board thickness');
  oneOf(spec.outerCopperOz, COPPER_WEIGHTS_OZ, 'the outer copper weight');
  oneOf(spec.innerCopperOz, COPPER_WEIGHTS_OZ, 'the inner copper weight');
  oneOf(spec.minViaHoleMm, MIN_VIA_HOLES_MM, 'the minimum via hole');
  oneOf(spec.outlineToleranceMm, OUTLINE_TOLERANCES_MM, 'the outline tolerance');

  const layers = spec.layerCount;

  if (layers !== undefined && layers < 4) {
    if (spec.innerCopperOz !== undefined) {
      throw new InvariantViolationError(
        'board-spec-inner-copper',
        'a board with fewer than four layers has no inner copper to weigh',
      );
    }
    if (spec.blindOrBuriedVias === true) {
      throw new InvariantViolationError(
        'board-spec-blind-vias',
        'blind or buried vias need at least four layers',
      );
    }
  }

  if (layers !== undefined && layers >= 6 && (spec.thicknessMm ?? 1.6) < 1.0) {
    throw new InvariantViolationError(
      'board-spec-thickness',
      'a board of six layers or more needs to be at least 1.0mm thick',
    );
  }

  if (spec.distinctDesigns !== undefined) {
    if (!Number.isInteger(spec.distinctDesigns) || spec.distinctDesigns < 1) {
      throw new InvariantViolationError(
        'board-spec-designs',
        'the number of different designs is a whole number of at least one',
      );
    }
    if (spec.distinctDesigns > MAX_DISTINCT_DESIGNS) {
      throw new InvariantViolationError(
        'board-spec-designs',
        `at most ${MAX_DISTINCT_DESIGNS} different designs can travel on one panel`,
      );
    }
    if (spec.distinctDesigns > 1 && spec.deliveryFormat === 'single_pcb') {
      throw new InvariantViolationError(
        'board-spec-designs',
        'more than one design has to be delivered as a panel',
      );
    }
  }

  const assembling = requirements.assembly !== 'none';

  if (!assembling) {
    for (const [field, value] of [
      ['the assembled face', spec.assembledFace],
      ['who supplies the parts', spec.partsSuppliedBy],
      ['who adds the tooling holes', spec.toolingHolesAddedBy],
    ] as const) {
      if (value !== undefined) {
        throw new InvariantViolationError(
          'board-spec-assembly-answer',
          `this request asks for no assembly, so ${field} does not apply`,
        );
      }
    }
    if (spec.conformalCoating === true || spec.functionalTest === true) {
      throw new InvariantViolationError(
        'board-spec-assembly-answer',
        'coating and functional test are part of assembly, which this request does not ask for',
      );
    }
  }

  if (assembling && spec.stencilRequired === true) {
    throw new InvariantViolationError(
      'board-spec-stencil',
      'a stencil is for populating the board yourself; this request asks the manufacturer to assemble it',
    );
  }

  if (
    spec.assembledFace !== undefined &&
    requirements.assemblySides === 'double_side'
  ) {
    throw new InvariantViolationError(
      'board-spec-assembled-face',
      'both sides are being populated, so a single assembled face cannot be named',
    );
  }
};

/**
 * The specification and the services asked for have to agree.
 *
 * Saying the manufacturer supplies the parts while not asking for parts sourcing
 * to be quoted produces a quote that does not cover the parts — the commonest
 * way a manufacturing request goes wrong.
 */
export const assertSpecAgreesWithServices = (
  spec: BoardSpec,
  services: readonly QuotedService[],
): void => {
  if (spec.partsSuppliedBy === 'manufacturer' && !services.includes('parts_sourcing')) {
    throw new InvariantViolationError(
      'spec-services-disagree',
      'the specification says the manufacturer supplies the parts, so parts sourcing has to be quoted',
    );
  }
  if (spec.stencilRequired === true && !services.includes('stencil')) {
    throw new InvariantViolationError(
      'spec-services-disagree',
      'the specification asks for a stencil, so it has to be quoted',
    );
  }
};

/** How much of the specification the buyer has actually pinned down. */
export const specifiedFieldCount = (spec: object): number =>
  Object.entries(spec).filter(
    ([key, value]) =>
      key !== 'requirementsId' &&
      key !== 'createdAt' &&
      key !== 'updatedAt' &&
      value !== null &&
      value !== undefined &&
      value !== false &&
      value !== '',
  ).length;
