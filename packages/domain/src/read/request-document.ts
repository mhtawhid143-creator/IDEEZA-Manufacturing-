/**
 * How the request document reads, for both sides of it.
 *
 * The buyer writes the production boundary and the manufacturer quotes against
 * it, so the two panels have to render the same document with the same words. If
 * each app kept its own labels they would drift — one would say "HASL (with
 * lead)" and the other "hasl_leaded", and a dispute would turn on which screen
 * someone was looking at.
 *
 * So the reading of it lives here, once, in the domain: pure functions over the
 * stored values, no database and no framework. Both apps call them and neither
 * has label maps of its own.
 */
import {
  BASE_MATERIAL_LABEL,
  BOARD_PACKAGING_LABEL,
  DELIVERY_FORMAT_LABEL,
  ELECTRICAL_TEST_LABEL,
  MARK_ON_BOARD_LABEL,
  SUPPLIED_BY_LABEL,
  SURFACE_FINISH_LABEL_BOARD,
  UL_MARKING_LABEL,
  VIA_COVERING_LABEL,
  WORKMANSHIP_CLASS_LABEL,
  type AssembledFace,
  type BaseMaterial,
  type BoardColor,
  type BoardPackaging,
  type BoardSurfaceFinish,
  type DeliveryFormat,
  type ElectricalTest,
  type MarkOnBoard,
  type SilkscreenColor,
  type SuppliedBy,
  type UlMarking,
  type ViaCovering,
  type WorkmanshipClass,
} from '../status/board.js';
import {
  INFILL_PATTERN_LABEL,
  PRINT_TECHNOLOGY_LABEL,
  SUPPORT_STRUCTURE_LABEL,
  SURFACE_FINISH_LABEL,
  type InfillPattern,
  type PrintTechnology,
  type SupportStructure,
  type SurfaceFinish,
} from '../status/print.js';
import type { AssemblyMode, PackageKind } from '../entities/product.js';
import type {
  AssemblySides,
  QuotedService,
  RfqDeclineReason,
} from '../status/index.js';

export interface DocumentRow {
  readonly label: string;
  readonly value: string;
}

/** What a buyer leaving a row open actually means, said the same way twice. */
export const OPEN_ANSWER = "Manufacturer's discretion";

const yesNo = (value: boolean): string => (value ? 'Yes' : 'No');

const sentence = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');

export const PACKAGE_KIND_LABEL: Readonly<Record<PackageKind, string>> = Object.freeze({
  pcb: 'PCB',
  module_3d: '3D module',
  full_product: 'PCB + 3D',
});

export const ASSEMBLY_MODE_LABEL: Readonly<Record<AssemblyMode, string>> = Object.freeze({
  // Not "bare boards": this row is read on a print-only request too, where
  // there are no boards to be bare.
  none: 'No assembly asked for',
  smt: 'Surface mount',
  through_hole: 'Through hole',
  mixed: 'Surface mount and through hole',
});

export const ASSEMBLY_SIDES_LABEL: Readonly<Record<AssemblySides, string>> = Object.freeze({
  single_side: 'One side populated',
  double_side: 'Both sides populated',
});

export const SUBSTITUTION_POLICY_LABEL: Readonly<Record<string, string>> = Object.freeze({
  not_allowed: 'No substitutions',
  with_approval: 'Substitutions with the buyer’s approval',
  manufacturer_discretion: 'Substitutions at the manufacturer’s discretion',
});

export const SERVICE_LABEL: Readonly<Record<QuotedService, string>> = Object.freeze({
  pcb_fabrication: 'Fabrication',
  parts_sourcing: 'Parts sourcing',
  pcb_assembly: 'Assembly',
  enclosure_3d: '3D / enclosure',
  stencil: 'Stencil',
  testing: 'Testing',
});

export interface RequirementsDocument {
  readonly quantity: number;
  readonly material: string;
  readonly manufacturingMethod: string;
  readonly tolerance: string;
  readonly leadTimeDays: number;
  readonly shippingRequirement: string;
  readonly assembly: AssemblyMode;
  readonly assemblySides: AssemblySides | null;
  readonly qualityCheckRequirement: string;
  readonly substitutionPolicy: string;
  readonly notes: string | null;
  readonly printTechnology?: PrintTechnology | null;
  readonly printMaterial?: string | null;
  readonly printColor?: string | null;
  readonly surfaceFinish?: SurfaceFinish | null;
  readonly infillPercent?: number | null;
}

/**
 * The structured requirements, as both sides read them.
 *
 * This is the brief: what is being made, how many, to what tolerance, by when.
 * The printed part's own answers used to be appended here, and are not any more
 * (UIUX-153) — a printed part has a specification of its own, the peer of the
 * board's, and the same fact printed in two places is how two screens start
 * disagreeing about one job.
 */
export const requirementRows = (
  requirements: RequirementsDocument,
): readonly DocumentRow[] => {
  const rows: DocumentRow[] = [
    { label: 'Quantity', value: String(requirements.quantity) },
    { label: 'Material', value: requirements.material },
    { label: 'Method', value: requirements.manufacturingMethod },
    { label: 'Tolerance', value: requirements.tolerance },
    {
      label: 'Assembly',
      value:
        ASSEMBLY_MODE_LABEL[requirements.assembly] +
        (requirements.assemblySides === null
          ? ''
          : ` · ${ASSEMBLY_SIDES_LABEL[requirements.assemblySides]}`),
    },
    { label: 'Quality check', value: requirements.qualityCheckRequirement },
    { label: 'Shipping', value: requirements.shippingRequirement },
    {
      label: 'Substitutions',
      value:
        SUBSTITUTION_POLICY_LABEL[requirements.substitutionPolicy] ??
        sentence(requirements.substitutionPolicy),
    },
    { label: 'Lead time asked for', value: `${requirements.leadTimeDays} days` },
  ];

  if (requirements.notes !== null && requirements.notes !== '') {
    rows.push({ label: 'Notes', value: requirements.notes });
  }

  return rows;
};

export interface PrintSpecificationDocument {
  /** The five answers that sit on the requirements themselves. */
  readonly technology: PrintTechnology | null;
  readonly material: string | null;
  readonly color: string | null;
  readonly surfaceFinish: SurfaceFinish | null;
  readonly infillPercent: number | null;
  /** The detail, which is its own record — the peer of the board specification. */
  readonly layerHeightMm: number | null;
  readonly infillPattern: InfillPattern | null;
  readonly wallThicknessMm: number | null;
  readonly dimensionXMm: number | null;
  readonly dimensionYMm: number | null;
  readonly dimensionZMm: number | null;
  readonly toleranceMm: number | null;
  readonly supportStructure: SupportStructure | null;
  readonly orientationRequirement: string | null;
  /** Only for a flexible material, and only when the buyer has a number. */
  readonly durometer: string | null;
  readonly postProcessing: string | null;
  readonly certification: string | null;
}

/**
 * The size of the thing, as one box rather than three numbers.
 *
 * The separator is a multiplication sign and the unit is written once
 * (UIUX-155): "70.17 mm* 70.2 mm" read as a footnote marker between two
 * unrelated measurements, which is not what a bounding box is.
 */
const dimensions = (spec: PrintSpecificationDocument): string | null => {
  const axes = [spec.dimensionXMm, spec.dimensionYMm, spec.dimensionZMm];
  if (axes.some((axis) => axis === null)) return null;
  return `${axes.map((axis) => String(axis)).join(' × ')} mm`;
};

/**
 * The printed part's specification, as both sides read it.
 *
 * The peer of `boardSpecificationRows`, and for the same reason: a printed part
 * is priced on the process, the layer height, the walls, the size and the way it
 * is held up while it is made, and none of that fits in a general brief. A row
 * the buyer left open reads as the manufacturer's decision rather than as
 * blank, exactly as it does on the board.
 *
 * Two rows are left out rather than shown open, because they are not decisions
 * waiting to be made: durometer is meaningless on a rigid material, and a
 * certification nobody asked for is not part of the job.
 */
export const printSpecificationRows = (
  spec: PrintSpecificationDocument,
): readonly DocumentRow[] => {
  const size = dimensions(spec);
  const rows: DocumentRow[] = [
    {
      label: 'Print process',
      value: spec.technology === null ? OPEN_ANSWER : PRINT_TECHNOLOGY_LABEL[spec.technology],
    },
    { label: 'Material', value: spec.material ?? OPEN_ANSWER },
    { label: 'Colour', value: spec.color ?? OPEN_ANSWER },
    {
      label: 'Surface finish',
      value:
        spec.surfaceFinish === null ? OPEN_ANSWER : SURFACE_FINISH_LABEL[spec.surfaceFinish],
    },
    {
      label: 'Layer height',
      value: spec.layerHeightMm === null ? OPEN_ANSWER : `${spec.layerHeightMm}mm`,
    },
    {
      // The percentage and the pattern are one answer about the inside of the
      // part: 20% gyroid and 20% grid weigh the same and do not behave alike.
      label: 'Infill',
      value:
        spec.infillPercent === null
          ? OPEN_ANSWER
          : spec.infillPattern === null
            ? `${spec.infillPercent}%`
            : `${spec.infillPercent}% ${INFILL_PATTERN_LABEL[spec.infillPattern].toLowerCase()}`,
    },
    {
      label: 'Wall thickness',
      value: spec.wallThicknessMm === null ? OPEN_ANSWER : `${spec.wallThicknessMm}mm`,
    },
    { label: 'Dimensions', value: size ?? OPEN_ANSWER },
    {
      label: 'Tolerance',
      value: spec.toleranceMm === null ? OPEN_ANSWER : `+/-${spec.toleranceMm}mm`,
    },
    {
      label: 'Support',
      value:
        spec.supportStructure === null
          ? OPEN_ANSWER
          : SUPPORT_STRUCTURE_LABEL[spec.supportStructure],
    },
    { label: 'Orientation', value: spec.orientationRequirement ?? OPEN_ANSWER },
    { label: 'Post-processing', value: spec.postProcessing ?? OPEN_ANSWER },
  ];

  if (spec.durometer !== null && spec.durometer !== '') {
    rows.push({ label: 'Durometer', value: spec.durometer });
  }
  if (spec.certification !== null && spec.certification !== '') {
    rows.push({ label: 'Certification', value: spec.certification });
  }

  return rows;
};

/**
 * A print specification nobody has filled in.
 *
 * Read through `printSpecificationRows` it produces a full document of
 * "Manufacturer's discretion", which is what an unanswered specification means.
 * The board has the same, for the same reason.
 */
export const EMPTY_PRINT_SPECIFICATION: PrintSpecificationDocument = Object.freeze({
  technology: null,
  material: null,
  color: null,
  surfaceFinish: null,
  infillPercent: null,
  layerHeightMm: null,
  infillPattern: null,
  wallThicknessMm: null,
  dimensionXMm: null,
  dimensionYMm: null,
  dimensionZMm: null,
  toleranceMm: null,
  supportStructure: null,
  orientationRequirement: null,
  durometer: null,
  postProcessing: null,
  certification: null,
});

export interface BoardSpecificationDocument {
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
}

/**
 * The board specification, as both sides read it.
 *
 * Every row the buyer left open is spelled out as the manufacturer's choice,
 * because "not specified" and "we forgot to ask" look identical otherwise — and
 * the quote has to say what was chosen.
 */
export const boardSpecificationRows = (
  spec: BoardSpecificationDocument,
  context: { readonly assembly: AssemblyMode },
): readonly DocumentRow[] => {
  const rows: DocumentRow[] = [
    {
      label: 'Base material',
      value: spec.baseMaterial === null ? OPEN_ANSWER : BASE_MATERIAL_LABEL[spec.baseMaterial],
    },
    { label: 'Layers', value: spec.layerCount === null ? OPEN_ANSWER : String(spec.layerCount) },
    {
      label: 'Thickness',
      value: spec.thicknessMm === null ? OPEN_ANSWER : `${spec.thicknessMm.toFixed(1)}mm`,
    },
    {
      label: 'Board colour',
      value: spec.boardColor === null ? OPEN_ANSWER : sentence(spec.boardColor),
    },
    {
      label: 'Silkscreen',
      value: spec.silkscreenColor === null ? OPEN_ANSWER : sentence(spec.silkscreenColor),
    },
    {
      label: 'Surface finish',
      value:
        spec.surfaceFinish === null
          ? OPEN_ANSWER
          : SURFACE_FINISH_LABEL_BOARD[spec.surfaceFinish],
    },
    {
      label: 'Outer copper',
      value: spec.outerCopperOz === null ? OPEN_ANSWER : `${spec.outerCopperOz} oz`,
    },
    {
      label: 'Inner copper',
      value: spec.innerCopperOz === null ? OPEN_ANSWER : `${spec.innerCopperOz} oz`,
    },
    {
      label: 'Via covering',
      value: spec.viaCovering === null ? OPEN_ANSWER : VIA_COVERING_LABEL[spec.viaCovering],
    },
    {
      label: 'Minimum via hole',
      value: spec.minViaHoleMm === null ? OPEN_ANSWER : `${spec.minViaHoleMm}mm`,
    },
    {
      label: 'Outline tolerance',
      value:
        spec.outlineToleranceMm === null ? OPEN_ANSWER : `+/-${spec.outlineToleranceMm}mm`,
    },
    {
      label: 'Delivery format',
      value:
        spec.deliveryFormat === null ? OPEN_ANSWER : DELIVERY_FORMAT_LABEL[spec.deliveryFormat],
    },
    {
      label: 'Different designs',
      value: spec.distinctDesigns === null ? '1' : String(spec.distinctDesigns),
    },
    {
      label: 'Electrical test',
      value:
        spec.electricalTest === null ? OPEN_ANSWER : ELECTRICAL_TEST_LABEL[spec.electricalTest],
    },
    {
      label: 'Workmanship',
      value:
        spec.workmanshipClass === null
          ? OPEN_ANSWER
          : WORKMANSHIP_CLASS_LABEL[spec.workmanshipClass],
    },
    { label: 'Gold fingers', value: yesNo(spec.goldFingers) },
    { label: 'Castellated holes', value: yesNo(spec.castellatedHoles) },
    { label: 'Edge plating', value: yesNo(spec.edgePlating) },
    { label: 'Blind or buried vias', value: yesNo(spec.blindOrBuriedVias) },
    {
      label: 'UL marking',
      value: spec.ulMarking === null ? OPEN_ANSWER : UL_MARKING_LABEL[spec.ulMarking],
    },
    {
      label: 'Mark on board',
      value: spec.markOnBoard === null ? OPEN_ANSWER : MARK_ON_BOARD_LABEL[spec.markOnBoard],
    },
    {
      label: 'Packaging',
      value: spec.packaging === null ? OPEN_ANSWER : BOARD_PACKAGING_LABEL[spec.packaging],
    },
  ];

  if (context.assembly !== 'none') {
    rows.push(
      {
        label: 'Parts supplied by',
        value:
          spec.partsSuppliedBy === null
            ? OPEN_ANSWER
            : SUPPLIED_BY_LABEL[spec.partsSuppliedBy],
      },
      {
        label: 'Tooling holes added by',
        value:
          spec.toolingHolesAddedBy === null
            ? OPEN_ANSWER
            : SUPPLIED_BY_LABEL[spec.toolingHolesAddedBy],
      },
      {
        label: 'Assembled face',
        value: spec.assembledFace === null ? 'As the design needs' : sentence(spec.assembledFace),
      },
      { label: 'Conformal coating', value: yesNo(spec.conformalCoating) },
      { label: 'Functional test', value: yesNo(spec.functionalTest) },
    );
  } else {
    rows.push({ label: 'Stencil', value: yesNo(spec.stencilRequired) });
  }

  if (spec.remarks !== null && spec.remarks !== '') {
    rows.push({ label: 'Remarks', value: spec.remarks });
  }

  return rows;
};

/** The services a request asks to have quoted, in the platform's words. */
export const serviceLabels = (services: readonly string[]): readonly string[] =>
  services.map((service) => SERVICE_LABEL[service as QuotedService] ?? sentence(service));

/**
 * Why a shop declined, in one wording for both panels.
 *
 * Declining is a real answer, not a failure, and the buyer is owed the reason in
 * words rather than the stored token. The manufacturer picks from this list and
 * the buyer reads the same sentence back, so neither side can describe the same
 * decision differently.
 */
export const RFQ_DECLINE_REASON_LABEL: Readonly<Record<RfqDeclineReason, string>> =
  Object.freeze({
    capability_mismatch: 'Outside what this shop makes',
    capacity_unavailable: 'No capacity in the window asked for',
    below_minimum_order_quantity: 'Below this shop’s minimum order quantity',
    parts_unavailable: 'Parts on the bill of materials cannot be sourced',
    lead_time_not_achievable: 'The lead time asked for cannot be met',
    files_incomplete: 'The production files are not complete enough to quote',
    destination_not_served: 'This shop does not ship to the destination',
    other: 'Another reason, given in the note',
  });

export const declineReasonLabel = (reason: string | null): string | null =>
  reason === null
    ? null
    : (RFQ_DECLINE_REASON_LABEL[reason as RfqDeclineReason] ?? sentence(reason));

/**
 * The handful of requirement rows that read as a brief.
 *
 * A brief and a specification are the same record seen at two distances: the
 * brief is what a shop needs to decide whether to quote at all, the
 * specification is what it needs to price. Selecting from the rows rather than
 * rebuilding them keeps one set of labels, so the same fact cannot be worded two
 * ways on two tabs.
 */
const BRIEF_LABELS: readonly string[] = [
  'Method',
  'Material',
  'Tolerance',
  'Quality check',
  'Substitutions',
  'Lead time asked for',
];

export const briefRows = (rows: readonly DocumentRow[]): readonly DocumentRow[] =>
  BRIEF_LABELS.flatMap((label) => rows.filter((row) => row.label === label));

/**
 * A board specification nobody has filled in.
 *
 * Read through `boardSpecificationRows` it produces a full document of
 * "Manufacturer's discretion" — which is exactly what an unanswered
 * specification means, and what both panels have to show for it. Neither side
 * shows an empty screen where the other shows a document.
 */
export const EMPTY_BOARD_SPECIFICATION: BoardSpecificationDocument = Object.freeze({
  baseMaterial: null,
  layerCount: null,
  thicknessMm: null,
  boardColor: null,
  silkscreenColor: null,
  surfaceFinish: null,
  outerCopperOz: null,
  innerCopperOz: null,
  viaCovering: null,
  minViaHoleMm: null,
  outlineToleranceMm: null,
  deliveryFormat: null,
  distinctDesigns: null,
  electricalTest: null,
  goldFingers: false,
  castellatedHoles: false,
  edgePlating: false,
  blindOrBuriedVias: false,
  ulMarking: null,
  markOnBoard: null,
  workmanshipClass: null,
  packaging: null,
  assembledFace: null,
  partsSuppliedBy: null,
  toolingHolesAddedBy: null,
  conformalCoating: false,
  functionalTest: false,
  stencilRequired: false,
  remarks: null,
});
