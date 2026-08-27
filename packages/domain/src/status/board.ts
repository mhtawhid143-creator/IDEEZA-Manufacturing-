/**
 * The board specification a buyer can ask for.
 *
 * The design this comes from is one fabrication house's order form, with that
 * house's material brands, its internal review steps and its storage services
 * in it. A request on this platform goes to several manufacturers who each quote
 * against it, so every option here is one any competent shop can read: the
 * industry value, not a supplier's product name. A shop's own brands, packaging
 * lines and process preferences belong in its quote.
 *
 * Every field is optional. A missing value means the manufacturer decides, which
 * is the honest default: most buyers know the layer count and the finish they
 * need and nothing else, and forcing them to invent the rest would put made-up
 * constraints into a document that a dispute is later decided on.
 */
export const BASE_MATERIALS = ['fr4', 'flex', 'aluminium', 'rogers', 'ptfe_teflon'] as const;
export type BaseMaterial = (typeof BASE_MATERIALS)[number];

export const BOARD_COLORS = [
  'green',
  'black',
  'white',
  'blue',
  'red',
  'yellow',
  'purple',
] as const;
export type BoardColor = (typeof BOARD_COLORS)[number];

export const SILKSCREEN_COLORS = ['white', 'black'] as const;
export type SilkscreenColor = (typeof SILKSCREEN_COLORS)[number];

export const BOARD_SURFACE_FINISHES = [
  'hasl_leaded',
  'hasl_lead_free',
  'enig',
  'osp',
  'immersion_silver',
  'hard_gold',
] as const;
export type BoardSurfaceFinish = (typeof BOARD_SURFACE_FINISHES)[number];

export const VIA_COVERINGS = [
  'tented',
  'untented',
  'plugged',
  'epoxy_filled_capped',
  'copper_paste_filled_capped',
] as const;
export type ViaCovering = (typeof VIA_COVERINGS)[number];

export const DELIVERY_FORMATS = [
  'single_pcb',
  'panel_by_buyer',
  'panel_by_manufacturer',
] as const;
export type DeliveryFormat = (typeof DELIVERY_FORMATS)[number];

export const ELECTRICAL_TESTS = ['none', 'sample', 'flying_probe_full', 'fixture_full'] as const;
export type ElectricalTest = (typeof ELECTRICAL_TESTS)[number];

export const UL_MARKINGS = ['none', 'any_position', 'specified_position'] as const;
export type UlMarking = (typeof UL_MARKINGS)[number];

export const MARKS_ON_BOARD = [
  'none',
  'order_number',
  'order_number_specified_position',
  'datamatrix_serial',
] as const;
export type MarkOnBoard = (typeof MARKS_ON_BOARD)[number];

export const WORKMANSHIP_CLASSES = ['ipc_class_2', 'ipc_class_3'] as const;
export type WorkmanshipClass = (typeof WORKMANSHIP_CLASSES)[number];

export const BOARD_PACKAGINGS = [
  'manufacturer_standard',
  'antistatic_bubble',
  'vacuum_esd_bag',
] as const;
export type BoardPackaging = (typeof BOARD_PACKAGINGS)[number];

export const ASSEMBLED_FACES = ['top', 'bottom'] as const;
export type AssembledFace = (typeof ASSEMBLED_FACES)[number];

export const SUPPLIED_BY = ['buyer', 'manufacturer'] as const;
export type SuppliedBy = (typeof SUPPLIED_BY)[number];

/** The counts and sizes a shop can actually run. */
export const LAYER_COUNTS = [1, 2, 4, 6, 8, 10, 12] as const;
export const BOARD_THICKNESSES_MM = [0.4, 0.6, 0.8, 1.0, 1.2, 1.6, 2.0, 2.4] as const;
export const COPPER_WEIGHTS_OZ = [0.5, 1, 2, 3, 4] as const;
export const MIN_VIA_HOLES_MM = [0.15, 0.2, 0.25, 0.3] as const;
export const OUTLINE_TOLERANCES_MM = [0.1, 0.2] as const;
export const MAX_DISTINCT_DESIGNS = 8;

export const BASE_MATERIAL_LABEL: Readonly<Record<BaseMaterial, string>> = Object.freeze({
  fr4: 'FR-4',
  flex: 'Flex',
  aluminium: 'Aluminium',
  rogers: 'Rogers',
  ptfe_teflon: 'PTFE / Teflon',
});

export const SURFACE_FINISH_LABEL_BOARD: Readonly<Record<BoardSurfaceFinish, string>> =
  Object.freeze({
    hasl_leaded: 'HASL (with lead)',
    hasl_lead_free: 'HASL (lead free)',
    enig: 'ENIG',
    osp: 'OSP',
    immersion_silver: 'Immersion silver',
    hard_gold: 'Hard gold',
  });

export const VIA_COVERING_LABEL: Readonly<Record<ViaCovering, string>> = Object.freeze({
  tented: 'Tented',
  untented: 'Untented',
  plugged: 'Plugged',
  epoxy_filled_capped: 'Epoxy filled and capped',
  copper_paste_filled_capped: 'Copper paste filled and capped',
});

export const DELIVERY_FORMAT_LABEL: Readonly<Record<DeliveryFormat, string>> = Object.freeze({
  single_pcb: 'Single PCB',
  panel_by_buyer: 'Panel, as I supply it',
  panel_by_manufacturer: 'Panel, arranged by the manufacturer',
});

export const ELECTRICAL_TEST_LABEL: Readonly<Record<ElectricalTest, string>> = Object.freeze({
  none: 'None',
  sample: 'Sample test',
  flying_probe_full: 'Flying probe, every board',
  fixture_full: 'Test fixture, every board',
});

export const UL_MARKING_LABEL: Readonly<Record<UlMarking, string>> = Object.freeze({
  none: 'No UL marking',
  any_position: 'UL mark, any position',
  specified_position: 'UL mark, position I specify',
});

export const MARK_ON_BOARD_LABEL: Readonly<Record<MarkOnBoard, string>> = Object.freeze({
  none: 'No mark',
  order_number: 'Order number, any position',
  order_number_specified_position: 'Order number, position I specify',
  datamatrix_serial: '2D barcode with a serial number',
});

export const WORKMANSHIP_CLASS_LABEL: Readonly<Record<WorkmanshipClass, string>> =
  Object.freeze({
    ipc_class_2: 'IPC-A-600 Class 2',
    ipc_class_3: 'IPC-A-600 Class 3',
  });

export const BOARD_PACKAGING_LABEL: Readonly<Record<BoardPackaging, string>> = Object.freeze({
  manufacturer_standard: "The manufacturer's standard packing",
  antistatic_bubble: 'Antistatic bubble film',
  vacuum_esd_bag: 'Vacuum sealed ESD bag',
});

export const SUPPLIED_BY_LABEL: Readonly<Record<SuppliedBy, string>> = Object.freeze({
  buyer: 'I supply them',
  manufacturer: 'The manufacturer supplies them',
});
