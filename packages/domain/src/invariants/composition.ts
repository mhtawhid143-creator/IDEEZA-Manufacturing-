import { InvariantViolationError } from '../errors.js';
import {
  INFILL_MAX,
  INFILL_MIN,
  PRINT_MATERIALS,
  fileKindOf,
  usesInfill,
  type ManufacturingFileKind,
  type PrintTechnology,
} from '../status/print.js';
import type { PackageKind } from '../entities/product.js';
import type { QuotedService } from '../status/index.js';

/**
 * What is being sent to manufacture, derived from what was selected.
 *
 * The platform can send a 3D module on its own, a board on its own, or both as
 * one finished unit — so the package kind is a consequence of the files the
 * buyer included, not a separate answer they can contradict.
 */
export const packageKindForFiles = (fileNames: readonly string[]): PackageKind => {
  const kinds = new Set<ManufacturingFileKind>(fileNames.map((name) => fileKindOf(name)));
  const hasBoard = kinds.has('pcb');
  const has3d = kinds.has('model_3d');
  if (hasBoard && has3d) return 'full_product';
  if (has3d) return 'module_3d';
  return 'pcb';
};

export const includesModel3d = (fileNames: readonly string[]): boolean =>
  fileNames.some((name) => fileKindOf(name) === 'model_3d');

export const includesBoard = (fileNames: readonly string[]): boolean =>
  fileNames.some((name) => fileKindOf(name) === 'pcb');

/**
 * A request has to carry a file that can be made.
 *
 * Documents alone are not a package: a specification without a model or a board
 * is nothing a manufacturer can quote.
 */
export const assertCompositionIsMakeable = (fileNames: readonly string[]): void => {
  if (fileNames.length === 0) {
    throw new InvariantViolationError(
      'composition-empty',
      'choose at least one file to send',
    );
  }
  if (!includesBoard(fileNames) && !includesModel3d(fileNames)) {
    throw new InvariantViolationError(
      'composition-not-makeable',
      'the selection has only documents in it; include a board or a model file',
    );
  }
};

/**
 * Services that only make sense for the work in the package.
 *
 * Asking a printer for assembly, or a board house for an enclosure that is not
 * in the package, produces quotes nobody can compare.
 */
export const servicesForKind = (kind: PackageKind): readonly QuotedService[] => {
  if (kind === 'module_3d') return Object.freeze(['enclosure_3d', 'testing']);
  if (kind === 'pcb') {
    return Object.freeze([
      'pcb_fabrication',
      'parts_sourcing',
      'pcb_assembly',
      'stencil',
      'testing',
    ]);
  }
  return Object.freeze([
    'pcb_fabrication',
    'parts_sourcing',
    'pcb_assembly',
    'enclosure_3d',
    'stencil',
    'testing',
  ]);
};

export const assertServicesFitPackage = (
  kind: PackageKind,
  services: readonly QuotedService[],
): void => {
  const allowed = servicesForKind(kind);
  const stray = services.filter((service) => !allowed.includes(service));
  if (stray.length > 0) {
    throw new InvariantViolationError(
      'service-does-not-fit-package',
      `"${stray[0] ?? ''}" cannot be quoted for a ${kind.replace(/_/g, ' ')} package`,
    );
  }
};

export interface PrintSpec {
  readonly printTechnology?: PrintTechnology | undefined;
  readonly printMaterial?: string | undefined;
  readonly printColor?: string | undefined;
  readonly infillPercent?: number | undefined;
}

/**
 * A 3D module cannot be quoted without a process and a material.
 *
 * Everything else about a printed part follows from those two: what it can be
 * finished with, whether it has infill at all, and what it will cost. The check
 * runs only when a model file is in the package.
 */
export const assertPrintSpecComplete = (
  fileNames: readonly string[],
  spec: PrintSpec,
): void => {
  if (!includesModel3d(fileNames)) return;

  const technology = spec.printTechnology;
  if (technology === undefined) {
    throw new InvariantViolationError(
      'print-spec-incomplete',
      'a 3D module needs a process before it can be quoted',
    );
  }
  const material = spec.printMaterial?.trim() ?? '';
  if (material === '') {
    throw new InvariantViolationError(
      'print-spec-incomplete',
      'a 3D module needs a material before it can be quoted',
    );
  }
  if (!PRINT_MATERIALS[technology].includes(material)) {
    throw new InvariantViolationError(
      'print-material-not-available',
      `${material} cannot be run on ${technology.replace(/_/g, ' ')}`,
    );
  }
  if (spec.infillPercent !== undefined) {
    if (!usesInfill(technology)) {
      throw new InvariantViolationError(
        'print-infill-not-applicable',
        `${technology.replace(/_/g, ' ')} has no infill`,
      );
    }
    if (
      !Number.isInteger(spec.infillPercent) ||
      spec.infillPercent < INFILL_MIN ||
      spec.infillPercent > INFILL_MAX
    ) {
      throw new InvariantViolationError(
        'print-infill-range',
        `infill is a whole percentage from ${INFILL_MIN} to ${INFILL_MAX}`,
      );
    }
  }
};

/**
 * Assembly belongs to a board, so it is not asked of a print-only package.
 *
 * The design puts an assembly switch on every item row. One package carries one
 * assembly answer, because it is one production run: boards that need different
 * treatment are different packages, and therefore different requests.
 */
export const assertAssemblyFitsComposition = (
  fileNames: readonly string[],
  assembly: string,
): void => {
  if (assembly !== 'none' && !includesBoard(fileNames)) {
    throw new InvariantViolationError(
      'assembly-without-a-board',
      'there is no board in this package to assemble',
    );
  }
};
