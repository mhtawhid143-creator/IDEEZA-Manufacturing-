import {
  assertDraftEditable,
  assertPrintSpecApplies,
  assertPrintSpecCoherent,
  asId,
  fileKindOf,
  printSpecificationRows,
  type DocumentRow,
  type InfillPattern,
  type PrintSpecificationDocument,
  type PrintTechnology,
  type RfqId,
  type RfqStatus,
  type SupportStructure,
  type SurfaceFinish,
  type UserId,
} from '@ideeza/domain';
import type { SavePrintSpecInput } from '@ideeza/types';
import { database } from '@/lib/db.js';

export interface PrintSpecView {
  readonly draftId: RfqId;
  readonly status: RfqStatus;
  readonly editable: boolean;
  readonly lockedReason: string | null;
  readonly productName: string;
  readonly quantity: number;
  /** The model files the specification describes. */
  readonly modelFiles: readonly string[];
  readonly hasPrintedPart: boolean;
  readonly specifiedCount: number;
  readonly spec: PrintSpecificationDocument;
}

const number = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

/** How much of the document the buyer has actually answered. */
const answered = (spec: PrintSpecificationDocument): number =>
  Object.values(spec).filter((value) => value !== null && value !== '').length;

/**
 * The print specification of one request, and whether it can still be changed.
 *
 * Read the same way as the board's: a sent request is read-only, because its
 * requirements are the frozen boundary every quote is priced against.
 *
 * The document is assembled from two rows on purpose. The process, material,
 * colour, finish and infill percentage live on the requirements — those five are
 * what a printer needs to decide whether to quote at all, and they were captured
 * long before the depth was. `PrintSpecification` is the depth. Both are frozen
 * with the same requirements version, so they cannot describe different parts.
 */
export const getPrintSpec = async (
  buyerId: UserId,
  draftId: RfqId,
): Promise<PrintSpecView | null> => {
  const rfq = await database().rfq.findFirst({
    where: { id: draftId, buyerId },
    include: {
      requirements: { include: { printSpec: true } },
      package: {
        include: {
          product: { select: { name: true } },
          files: { include: { file: { select: { name: true } } } },
        },
      },
    },
  });

  if (rfq === null) return null;
  const fileNames = rfq.package.files.map((link) => link.file.name);
  const modelFiles = fileNames.filter((name) => fileKindOf(name) === 'model_3d');
  const detail = rfq.requirements.printSpec;

  let lockedReason: string | null = null;
  try {
    assertDraftEditable(asId<RfqId>(rfq.id), rfq.status);
  } catch (error) {
    lockedReason = error instanceof Error ? error.message : 'this request is not editable';
  }

  const spec: PrintSpecificationDocument = {
    technology: rfq.requirements.printTechnology,
    material: rfq.requirements.printMaterial,
    color: rfq.requirements.printColor,
    surfaceFinish: rfq.requirements.surfaceFinish,
    infillPercent: rfq.requirements.infillPercent,
    layerHeightMm: number(detail?.layerHeightMm),
    infillPattern: detail?.infillPattern ?? null,
    wallThicknessMm: number(detail?.wallThicknessMm),
    dimensionXMm: number(detail?.dimensionXMm),
    dimensionYMm: number(detail?.dimensionYMm),
    dimensionZMm: number(detail?.dimensionZMm),
    toleranceMm: number(detail?.toleranceMm),
    supportStructure: detail?.supportStructure ?? null,
    orientationRequirement: detail?.orientationRequirement ?? null,
    durometer: detail?.durometer ?? null,
    postProcessing: detail?.postProcessing ?? null,
    certification: detail?.certification ?? null,
  };

  return {
    draftId: asId<RfqId>(rfq.id),
    status: rfq.status,
    editable: lockedReason === null,
    lockedReason,
    productName: rfq.package.product.name,
    quantity: rfq.quantity,
    modelFiles,
    hasPrintedPart: modelFiles.length > 0,
    specifiedCount: answered(spec),
    spec,
  };
};

/**
 * Writes the print specification onto the request's own requirements row.
 *
 * The same rule as the board's: it is part of what manufacturers quote against,
 * so saving it after the request has gone out would change the question after
 * the answers came back, and a sent request is refused.
 */
export const savePrintSpec = async (
  buyerId: UserId,
  input: SavePrintSpecInput,
): Promise<void> => {
  const rfq = await database().rfq.findFirst({
    where: { id: input.draftId, buyerId },
    include: {
      requirements: {
        select: { id: true, printTechnology: true, printMaterial: true },
      },
      package: { include: { files: { include: { file: { select: { name: true } } } } } },
    },
  });

  if (rfq === null) throw new Error('That draft does not exist.');

  assertDraftEditable(asId<RfqId>(rfq.id), rfq.status);
  assertPrintSpecApplies(rfq.package.files.map((link) => link.file.name));
  assertPrintSpecCoherent(
    {
      ...(input.layerHeightMm === undefined ? {} : { layerHeightMm: input.layerHeightMm }),
      ...(input.infillPattern === undefined ? {} : { infillPattern: input.infillPattern }),
      ...(input.wallThicknessMm === undefined
        ? {}
        : { wallThicknessMm: input.wallThicknessMm }),
      ...(input.dimensionXMm === undefined ? {} : { dimensionXMm: input.dimensionXMm }),
      ...(input.dimensionYMm === undefined ? {} : { dimensionYMm: input.dimensionYMm }),
      ...(input.dimensionZMm === undefined ? {} : { dimensionZMm: input.dimensionZMm }),
      ...(input.toleranceMm === undefined ? {} : { toleranceMm: input.toleranceMm }),
      ...(input.supportStructure === undefined
        ? {}
        : { supportStructure: input.supportStructure }),
      ...(input.durometer === undefined ? {} : { durometer: input.durometer }),
    },
    {
      technology: rfq.requirements.printTechnology,
      material: rfq.requirements.printMaterial,
    },
  );

  const data = {
    layerHeightMm: input.layerHeightMm ?? null,
    infillPattern: input.infillPattern ?? null,
    wallThicknessMm: input.wallThicknessMm ?? null,
    dimensionXMm: input.dimensionXMm ?? null,
    dimensionYMm: input.dimensionYMm ?? null,
    dimensionZMm: input.dimensionZMm ?? null,
    toleranceMm: input.toleranceMm ?? null,
    supportStructure: input.supportStructure ?? null,
    orientationRequirement: input.orientationRequirement ?? null,
    durometer: input.durometer ?? null,
    postProcessing: input.postProcessing ?? null,
    certification: input.certification ?? null,
  };

  await database().printSpecification.upsert({
    where: { requirementsId: rfq.requirements.id },
    update: data,
    create: { requirementsId: rfq.requirements.id, ...data },
  });
};

/**
 * The specification as a manufacturer reads it.
 *
 * The reading lives in the domain — `printSpecificationRows` — because the
 * manufacturer panel renders the same document and the two must not drift.
 */
export const printSpecRows = (view: PrintSpecView): readonly DocumentRow[] =>
  printSpecificationRows(view.spec);

export type { InfillPattern, PrintTechnology, SupportStructure, SurfaceFinish };
