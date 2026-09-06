import { InvariantViolationError } from '../errors.js';
import {
  usesInfill,
  type InfillPattern,
  type PrintTechnology,
  type SupportStructure,
} from '../status/print.js';
import { includesModel3d } from './composition.js';

export interface PrintSpecDetail {
  readonly layerHeightMm?: number | undefined;
  readonly infillPattern?: InfillPattern | undefined;
  readonly wallThicknessMm?: number | undefined;
  readonly dimensionXMm?: number | undefined;
  readonly dimensionYMm?: number | undefined;
  readonly dimensionZMm?: number | undefined;
  readonly toleranceMm?: number | undefined;
  readonly supportStructure?: SupportStructure | undefined;
  readonly durometer?: string | undefined;
}

/** A print specification only means something for a package that prints. */
export const assertPrintSpecApplies = (fileNames: readonly string[]): void => {
  if (!includesModel3d(fileNames)) {
    throw new InvariantViolationError(
      'print-spec-without-a-printed-part',
      'this package has no printed part in it, so there is no print specification to edit',
    );
  }
};

/** The materials whose hardness is a number anybody quotes on. */
const FLEXIBLE = ['tpu', 'tpe', 'flexible', 'rubber', 'elastomer'];

/**
 * A print specification a shop could actually build to.
 *
 * These are physical impossibilities rather than preferences, which is why they
 * are refused here and not merely warned about on the form:
 *
 * - a bounding box is three axes or it is none; two of them describe nothing
 * - a tolerance finer than one layer is not a tolerance, it is a wish
 * - a wall thinner than one layer cannot be printed at all
 * - an infill pattern on a process that removes material rather than filling it
 *   is an answer to a question nobody asked
 * - a Shore hardness on a rigid material is a number with no meaning
 */
export const assertPrintSpecCoherent = (
  spec: PrintSpecDetail,
  context: {
    readonly technology: PrintTechnology | null;
    readonly material: string | null;
  },
): void => {
  const axes = [spec.dimensionXMm, spec.dimensionYMm, spec.dimensionZMm];
  const given = axes.filter((axis) => axis !== undefined).length;
  if (given !== 0 && given !== 3) {
    throw new InvariantViolationError(
      'print-spec-partial-box',
      'a size needs all three of width, depth and height, or none of them',
    );
  }

  if (
    spec.layerHeightMm !== undefined &&
    spec.toleranceMm !== undefined &&
    spec.toleranceMm < spec.layerHeightMm
  ) {
    throw new InvariantViolationError(
      'print-spec-tolerance-below-layer',
      `a tolerance of ${spec.toleranceMm}mm is finer than the ${spec.layerHeightMm}mm layer it would be built from`,
    );
  }

  if (
    spec.layerHeightMm !== undefined &&
    spec.wallThicknessMm !== undefined &&
    spec.wallThicknessMm < spec.layerHeightMm
  ) {
    throw new InvariantViolationError(
      'print-spec-wall-below-layer',
      `a ${spec.wallThicknessMm}mm wall is thinner than the ${spec.layerHeightMm}mm layer it would be built from`,
    );
  }

  if (
    spec.infillPattern !== undefined &&
    context.technology !== null &&
    !usesInfill(context.technology)
  ) {
    throw new InvariantViolationError(
      'print-spec-infill-without-fill',
      'this process does not fill a part, so it has no infill pattern',
    );
  }

  if (spec.durometer !== undefined && spec.durometer !== '') {
    const material = (context.material ?? '').toLowerCase();
    if (!FLEXIBLE.some((word) => material.includes(word))) {
      throw new InvariantViolationError(
        'print-spec-durometer-on-rigid',
        'a Shore hardness only means something on a flexible material',
      );
    }
  }
};
