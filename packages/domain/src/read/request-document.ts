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
  PRINT_TECHNOLOGY_LABEL,
  SURFACE_FINISH_LABEL,
  type PrintTechnology,
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
  none: 'No assembly — bare boards',
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
 * The print rows appear only when the package has a printed part in it, because
 * a bare board has no infill and showing an empty row invites someone to fill it
 * in later with a number nobody agreed to.
 */
export const requirementRows = (
  requirements: RequirementsDocument,
  options: { readonly includesPrint?: boolean } = {},
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

  if (options.includesPrint === true) {
    rows.push(
      {
        label: 'Print process',
        value:
          requirements.printTechnology === null ||
          requirements.printTechnology === undefined
            ? OPEN_ANSWER
            : PRINT_TECHNOLOGY_LABEL[requirements.printTechnology],
      },
      {
        label: 'Print material',
        value: requirements.printMaterial ?? OPEN_ANSWER,
      },
      { label: 'Colour', value: requirements.printColor ?? OPEN_ANSWER },
      {
        label: 'Surface finish',
        value:
          requirements.surfaceFinish === null || requirements.surfaceFinish === undefined
            ? OPEN_ANSWER
            : SURFACE_FINISH_LABEL[requirements.surfaceFinish],
      },
      {
        label: 'Infill',
        value:
          requirements.infillPercent === null || requirements.infillPercent === undefined
            ? OPEN_ANSWER
            : `${requirements.infillPercent}%`,
      },
    );
  }

  if (requirements.notes !== null && requirements.notes !== '') {
    rows.push({ label: 'Notes', value: requirements.notes });
  }

  return rows;
};

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
