import {
  EMPTY_BOARD_SPECIFICATION,
  assertBoardSpecApplies,
  assertBoardSpecCoherent,
  assertDraftEditable,
  asId,
  fileKindOf,
  boardSpecificationRows,
  specifiedFieldCount,
  type AssembledFace,
  type AssemblyMode,
  type AssemblySides,
  type BaseMaterial,
  type BoardColor,
  type BoardPackaging,
  type BoardSurfaceFinish,
  type DeliveryFormat,
  type DocumentRow,
  type ElectricalTest,
  type MarkOnBoard,
  type RfqId,
  type RfqStatus,
  type SilkscreenColor,
  type SuppliedBy,
  type UlMarking,
  type UserId,
  type ViaCovering,
  type WorkmanshipClass,
} from '@ideeza/domain';
import type { SaveBoardSpecInput } from '@ideeza/types';
import { database } from '@/lib/db.js';

export interface BoardSpecView {
  readonly draftId: RfqId;
  readonly status: RfqStatus;
  readonly editable: boolean;
  readonly lockedReason: string | null;
  readonly productName: string;
  readonly quantity: number;
  readonly assembly: AssemblyMode;
  readonly assemblySides: AssemblySides | null;
  readonly requestedServices: readonly string[];
  /** The board files the specification describes. */
  readonly boardFiles: readonly string[];
  readonly hasBoard: boolean;
  readonly specifiedCount: number;
  readonly spec: {
    readonly baseMaterial: BaseMaterial | null;
    readonly layerCount: number | null;
    readonly thicknessMm: number | null;
    readonly boardColor: BoardColor | null;
    readonly silkscreenColor: SilkscreenColor | null;
    readonly surfaceFinish: BoardSurfaceFinish | null;
    readonly outerCopperOz: number | null;
    readonly innerCopperOz: number | null;
    readonly viaCovering: ViaCovering | null;
    readonly minViaHoleMm: number | null;
    readonly outlineToleranceMm: number | null;
    readonly deliveryFormat: DeliveryFormat | null;
    readonly distinctDesigns: number | null;
    readonly electricalTest: ElectricalTest | null;
    readonly goldFingers: boolean;
    readonly castellatedHoles: boolean;
    readonly edgePlating: boolean;
    readonly blindOrBuriedVias: boolean;
    readonly ulMarking: UlMarking | null;
    readonly markOnBoard: MarkOnBoard | null;
    readonly workmanshipClass: WorkmanshipClass | null;
    readonly packaging: BoardPackaging | null;
    readonly assembledFace: AssembledFace | null;
    readonly partsSuppliedBy: SuppliedBy | null;
    readonly toolingHolesAddedBy: SuppliedBy | null;
    readonly conformalCoating: boolean;
    readonly functionalTest: boolean;
    readonly stencilRequired: boolean;
    readonly remarks: string | null;
  };
}

const number = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

/**
 * The board specification of one request, and whether it can still be changed.
 *
 * A sent request is read-only: its requirements are the frozen boundary every
 * quote is priced against, so the screen shows the same document without the
 * controls rather than pretending it can be edited.
 */
export const getBoardSpec = async (
  buyerId: UserId,
  draftId: RfqId,
): Promise<BoardSpecView | null> => {
  const rfq = await database().rfq.findFirst({
    where: { id: draftId, buyerId },
    include: {
      requirements: { include: { boardSpec: true } },
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
  const boardFiles = fileNames.filter((name) => fileKindOf(name) === 'pcb');
  const row = rfq.requirements.boardSpec;

  let lockedReason: string | null = null;
  try {
    assertDraftEditable(asId<RfqId>(rfq.id), rfq.status);
  } catch (error) {
    lockedReason = error instanceof Error ? error.message : 'this request is not editable';
  }

  const spec =
    row === null
      ? EMPTY_BOARD_SPECIFICATION
      : {
          baseMaterial: row.baseMaterial,
          layerCount: row.layerCount,
          thicknessMm: number(row.thicknessMm),
          boardColor: row.boardColor,
          silkscreenColor: row.silkscreenColor,
          surfaceFinish: row.surfaceFinish,
          outerCopperOz: number(row.outerCopperOz),
          innerCopperOz: number(row.innerCopperOz),
          viaCovering: row.viaCovering,
          minViaHoleMm: number(row.minViaHoleMm),
          outlineToleranceMm: number(row.outlineToleranceMm),
          deliveryFormat: row.deliveryFormat,
          distinctDesigns: row.distinctDesigns,
          electricalTest: row.electricalTest,
          goldFingers: row.goldFingers,
          castellatedHoles: row.castellatedHoles,
          edgePlating: row.edgePlating,
          blindOrBuriedVias: row.blindOrBuriedVias,
          ulMarking: row.ulMarking,
          markOnBoard: row.markOnBoard,
          workmanshipClass: row.workmanshipClass,
          packaging: row.packaging,
          assembledFace: row.assembledFace,
          partsSuppliedBy: row.partsSuppliedBy,
          toolingHolesAddedBy: row.toolingHolesAddedBy,
          conformalCoating: row.conformalCoating,
          functionalTest: row.functionalTest,
          stencilRequired: row.stencilRequired,
          remarks: row.remarks,
        };

  return {
    draftId: asId<RfqId>(rfq.id),
    status: rfq.status,
    editable: lockedReason === null,
    lockedReason,
    productName: rfq.package.product.name,
    quantity: rfq.quantity,
    assembly: rfq.requirements.assembly,
    assemblySides: rfq.requirements.assemblySides,
    requestedServices: rfq.requestedServices,
    boardFiles,
    hasBoard: boardFiles.length > 0,
    specifiedCount: specifiedFieldCount(spec),
    spec,
  };
};

/**
 * Writes the board specification onto the request's own requirements row.
 *
 * It belongs to the requirements, not to the order, because it is part of what
 * manufacturers quote against: saving it after the request has gone out would
 * change the question after the answers came back, so a sent request is refused.
 */
export const saveBoardSpec = async (
  buyerId: UserId,
  input: SaveBoardSpecInput,
): Promise<void> => {
  const rfq = await database().rfq.findFirst({
    where: { id: input.draftId, buyerId },
    include: {
      requirements: { select: { id: true, assembly: true, assemblySides: true } },
      package: { include: { files: { include: { file: { select: { name: true } } } } } },
    },
  });
  if (rfq === null) throw new Error('That draft does not exist.');

  assertDraftEditable(asId<RfqId>(rfq.id), rfq.status);
  assertBoardSpecApplies(rfq.package.files.map((link) => link.file.name));
  assertBoardSpecCoherent(
    {
      ...(input.layerCount === undefined ? {} : { layerCount: input.layerCount }),
      ...(input.thicknessMm === undefined ? {} : { thicknessMm: input.thicknessMm }),
      ...(input.outerCopperOz === undefined ? {} : { outerCopperOz: input.outerCopperOz }),
      ...(input.innerCopperOz === undefined ? {} : { innerCopperOz: input.innerCopperOz }),
      ...(input.minViaHoleMm === undefined ? {} : { minViaHoleMm: input.minViaHoleMm }),
      ...(input.outlineToleranceMm === undefined
        ? {}
        : { outlineToleranceMm: input.outlineToleranceMm }),
      ...(input.deliveryFormat === undefined ? {} : { deliveryFormat: input.deliveryFormat }),
      ...(input.distinctDesigns === undefined
        ? {}
        : { distinctDesigns: input.distinctDesigns }),
      blindOrBuriedVias: input.blindOrBuriedVias,
      ...(input.assembledFace === undefined ? {} : { assembledFace: input.assembledFace }),
      ...(input.partsSuppliedBy === undefined
        ? {}
        : { partsSuppliedBy: input.partsSuppliedBy }),
      ...(input.toolingHolesAddedBy === undefined
        ? {}
        : { toolingHolesAddedBy: input.toolingHolesAddedBy }),
      conformalCoating: input.conformalCoating,
      functionalTest: input.functionalTest,
      stencilRequired: input.stencilRequired,
      ...(input.packaging === undefined ? {} : { packaging: input.packaging }),
    },
    {
      assembly: rfq.requirements.assembly,
      assemblySides: rfq.requirements.assemblySides,
    },
  );

  const data = {
    baseMaterial: input.baseMaterial ?? null,
    layerCount: input.layerCount ?? null,
    thicknessMm: input.thicknessMm ?? null,
    boardColor: input.boardColor ?? null,
    silkscreenColor: input.silkscreenColor ?? null,
    surfaceFinish: input.surfaceFinish ?? null,
    outerCopperOz: input.outerCopperOz ?? null,
    innerCopperOz: input.innerCopperOz ?? null,
    viaCovering: input.viaCovering ?? null,
    minViaHoleMm: input.minViaHoleMm ?? null,
    outlineToleranceMm: input.outlineToleranceMm ?? null,
    deliveryFormat: input.deliveryFormat ?? null,
    distinctDesigns: input.distinctDesigns ?? null,
    electricalTest: input.electricalTest ?? null,
    goldFingers: input.goldFingers,
    castellatedHoles: input.castellatedHoles,
    edgePlating: input.edgePlating,
    blindOrBuriedVias: input.blindOrBuriedVias,
    ulMarking: input.ulMarking ?? null,
    markOnBoard: input.markOnBoard ?? null,
    workmanshipClass: input.workmanshipClass ?? null,
    packaging: input.packaging ?? null,
    assembledFace: input.assembledFace ?? null,
    partsSuppliedBy: input.partsSuppliedBy ?? null,
    toolingHolesAddedBy: input.toolingHolesAddedBy ?? null,
    conformalCoating: input.conformalCoating,
    functionalTest: input.functionalTest,
    stencilRequired: input.stencilRequired,
    remarks: input.remarks ?? null,
  };

  await database().boardSpecification.upsert({
    where: { requirementsId: rfq.requirements.id },
    update: data,
    create: { requirementsId: rfq.requirements.id, ...data },
  });
};

/**
 * The specification as a manufacturer reads it.
 *
 * The reading itself lives in the domain — `boardSpecificationRows` — because the
 * manufacturer panel renders the same document and the two must not drift. This
 * is only the adapter from the buyer view onto it.
 */
export type SpecRow = DocumentRow;

export const boardSpecRows = (view: BoardSpecView): readonly SpecRow[] =>
  boardSpecificationRows(view.spec, { assembly: view.assembly });
