import type { PackageKind } from '../entities/product.js';

/**
 * What a production file is *for*, as against what format it is in
 * (UIUX-147, UIUX-148).
 *
 * `fileKindOf` already answers "is this a board file or a model", which is what
 * decides the kind of work. This answers the different and more useful question
 * a shop asks when it opens the tab: is everything I need to make this here?
 * Without roles the tab can only list what arrived; it cannot say what is
 * missing, and a shop discovering at the bench that there is no drill file has
 * already quoted.
 */
export const PRODUCTION_FILE_ROLES = [
  // Boards
  'gerber',
  'drill',
  'fabrication_drawing',
  'pick_and_place',
  'assembly_drawing',
  'panelisation',
  // Printed parts
  'model_3d',
  'print_specification',
  'orientation_notes',
  'finish_specification',
  // Either
  'bom',
  // Neither: a design artifact, kept separate on purpose. See below.
  'schematic',
  'other',
] as const;

export type ProductionFileRole = (typeof PRODUCTION_FILE_ROLES)[number];

export const PRODUCTION_FILE_LABEL: Readonly<Record<ProductionFileRole, string>> =
  Object.freeze({
    gerber: 'Gerber files',
    drill: 'Drill file',
    fabrication_drawing: 'Fabrication drawing',
    pick_and_place: 'Pick-and-place file',
    assembly_drawing: 'Assembly drawing',
    panelisation: 'Panelisation drawing',
    model_3d: '3D model',
    print_specification: 'Print specification',
    orientation_notes: 'Orientation and supports',
    finish_specification: 'Finish and post-processing',
    bom: 'Bill of materials',
    schematic: 'Schematic',
    other: 'Other',
  });

/** What each is for, said to the shop rather than assumed. */
export const PRODUCTION_FILE_PURPOSE: Readonly<Record<ProductionFileRole, string>> =
  Object.freeze({
    gerber: 'The copper, mask and silkscreen layers the board is imaged from.',
    drill: 'Where the holes go, and how big they are.',
    fabrication_drawing: 'Outline, stack-up, material and the tolerances they are held to.',
    pick_and_place: 'Where each part sits: X, Y, rotation and which side.',
    assembly_drawing: 'What goes where, by reference designator.',
    panelisation: 'How the boards are arranged on the panel you will run.',
    model_3d: 'The geometry itself, in a print-ready format.',
    print_specification: 'Material, process, resolution, infill and tolerances.',
    orientation_notes: 'How the buyer wants it laid on the bed, and where supports may go.',
    finish_specification: 'Colour, smoothing, painting — whatever happens after printing.',
    bom: 'The parts to source, and how many of each.',
    schematic: 'The circuit design. Not a manufacturing input.',
    other: 'Supporting material.',
  });

const ROLE_HINTS: readonly { readonly role: ProductionFileRole; readonly words: readonly string[] }[] = [
  { role: 'pick_and_place', words: ['pick', 'place', 'centroid', 'cpl', 'xyrs'] },
  { role: 'assembly_drawing', words: ['assembly', 'assy'] },
  { role: 'panelisation', words: ['panel'] },
  { role: 'fabrication_drawing', words: ['fab', 'fabrication', 'drawing', 'stackup', 'stack-up'] },
  { role: 'drill', words: ['drill', 'excellon', 'nc-drill'] },
  { role: 'gerber', words: ['gerber', 'gbr', 'copper', 'soldermask', 'silkscreen'] },
  { role: 'schematic', words: ['schematic', 'sch'] },
  { role: 'print_specification', words: ['print-spec', 'printspec', 'print_spec', 'slicer'] },
  { role: 'orientation_notes', words: ['orientation', 'support'] },
  { role: 'finish_specification', words: ['finish', 'post-process', 'postprocess', 'paint'] },
  { role: 'bom', words: ['bom', 'bill-of-material', 'billofmaterials', 'parts-list'] },
];

const BOARD_EXTENSIONS = ['gbr', 'gtl', 'gbl', 'gts', 'gbs', 'gto', 'gbo'];
const MODEL_EXTENSIONS = ['stl', 'step', 'stp', '3mf', 'obj', 'iges', 'igs', 'sldprt', 'f3d'];

/**
 * What this file appears to be for, from its name.
 *
 * A guess, and named as one wherever it is shown: the platform records a file's
 * name rather than reading its contents, so the honest thing is to sort by what
 * the name says and let the shop correct it by eye. The extension decides only
 * when the name says nothing — a `.zip` called "gerbers" is gerbers, a `.zip`
 * called "assembly-pack" is not.
 */
export const productionFileRoleOf = (fileName: string): ProductionFileRole => {
  const lower = fileName.toLowerCase();
  for (const hint of ROLE_HINTS) {
    if (hint.words.some((word) => lower.includes(word))) return hint.role;
  }
  const extension = lower.includes('.') ? (lower.split('.').pop() ?? '') : '';
  if (extension === 'drl') return 'drill';
  if (BOARD_EXTENSIONS.includes(extension)) return 'gerber';
  if (MODEL_EXTENSIONS.includes(extension)) return 'model_3d';
  if (extension === 'csv' || extension === 'xlsx') return 'bom';
  return 'other';
};

export interface ProductionFileWork {
  readonly packageKind: PackageKind;
  /** Whether the buyer asked for the parts to be placed, not just the board made. */
  readonly assemblyAsked: boolean;
  /** Whether the printed work is more than one piece, or takes inserts. */
  readonly multiPart: boolean;
  /** Whether the boards are panelised for production. */
  readonly panelised: boolean;
}

export interface RequiredProductionFile {
  readonly role: ProductionFileRole;
  /**
   * `always` — the work cannot be made without it, and its absence is a gap in
   * the request. `if_specified` — the buyer may have an opinion, and its absence
   * means they left the choice to the shop rather than that something is
   * missing. The difference is the whole point: a tab that calls both "missing"
   * teaches a shop to ignore it.
   */
  readonly requirement: 'always' | 'if_specified';
}

/**
 * The files this request ought to carry.
 *
 * The board set and the printed set are separate because they have nothing in
 * common, and the conditional halves are conditional on what the buyer actually
 * asked for: no pick-and-place on a board nobody asked to have assembled, no
 * bill of materials on a single printed piece.
 *
 * The schematic is deliberately absent. It is a circuit design, not a
 * fabrication input, and a shop does not need it to make a board — so the
 * platform does not ask a buyer for their IP by default. One arriving anyway is
 * shown, and said to be extra rather than counted as required.
 */
export const requiredProductionFiles = (
  work: ProductionFileWork,
): readonly RequiredProductionFile[] => {
  const board: RequiredProductionFile[] = [
    { role: 'gerber', requirement: 'always' },
    { role: 'drill', requirement: 'always' },
    { role: 'fabrication_drawing', requirement: 'always' },
  ];
  if (work.assemblyAsked) {
    board.push(
      { role: 'pick_and_place', requirement: 'always' },
      { role: 'bom', requirement: 'always' },
      { role: 'assembly_drawing', requirement: 'always' },
    );
  }
  if (work.panelised) board.push({ role: 'panelisation', requirement: 'always' });

  const printed: RequiredProductionFile[] = [
    { role: 'model_3d', requirement: 'always' },
    { role: 'print_specification', requirement: 'always' },
    { role: 'orientation_notes', requirement: 'if_specified' },
    { role: 'finish_specification', requirement: 'if_specified' },
  ];
  if (work.multiPart) printed.push({ role: 'bom', requirement: 'always' });

  if (work.packageKind === 'pcb') return board;
  if (work.packageKind === 'module_3d') return printed;

  // Both, with the shared bill of materials named once.
  const seen = new Set<ProductionFileRole>();
  return [...board, ...printed].filter((entry) => {
    if (seen.has(entry.role)) return false;
    seen.add(entry.role);
    return true;
  });
};

/**
 * Whether a bill of materials is a manufacturing input for this work
 * (UIUX-156).
 *
 * A fabrication-only board has nothing to source, and a single printed piece
 * has no parts. Showing a populated table anyway makes "no BOM needed" look
 * identical to "the BOM failed to load", and a shop cannot tell those apart.
 */
export const bomIsRequired = (work: ProductionFileWork): boolean =>
  (work.packageKind !== 'module_3d' && work.assemblyAsked) ||
  (work.packageKind !== 'pcb' && work.multiPart);
