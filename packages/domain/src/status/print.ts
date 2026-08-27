/**
 * How a printed or machined part is made.
 *
 * A printer quotes on the process, the material and the finish, so these are
 * part of the structured request rather than prose in a note. They apply only
 * when the package includes a 3D module: a bare board has no infill.
 */
export const PRINT_TECHNOLOGIES = ['fdm', 'sla', 'sls', 'mjf', 'cnc_machining'] as const;
export type PrintTechnology = (typeof PRINT_TECHNOLOGIES)[number];

export const SURFACE_FINISHES = [
  'as_printed',
  'sanded',
  'bead_blasted',
  'vapour_smoothed',
  'painted',
] as const;
export type SurfaceFinish = (typeof SURFACE_FINISHES)[number];

/**
 * The materials each process can actually run.
 *
 * The pairing matters: asking for a resin part on a filament printer is not a
 * preference, it is a mistake, and it is cheaper to refuse it here than to
 * discover it in a quote.
 */
export const PRINT_MATERIALS: Readonly<Record<PrintTechnology, readonly string[]>> =
  Object.freeze({
    fdm: Object.freeze(['PLA', 'PETG', 'ABS', 'ASA', 'PA12-CF']),
    sla: Object.freeze(['Standard resin', 'Tough resin', 'High-temp resin']),
    sls: Object.freeze(['PA12', 'PA11', 'PA12 glass filled']),
    mjf: Object.freeze(['PA12', 'PA12 glass filled', 'TPU']),
    cnc_machining: Object.freeze([
      'Aluminium 6061',
      'Aluminium 7075',
      'Stainless 304',
      'Brass',
      'POM',
    ]),
  });

export const PRINT_TECHNOLOGY_LABEL: Readonly<Record<PrintTechnology, string>> =
  Object.freeze({
    fdm: 'FDM (filament)',
    sla: 'SLA (resin)',
    sls: 'SLS (powder)',
    mjf: 'MJF (powder)',
    cnc_machining: 'CNC machining',
  });

export const SURFACE_FINISH_LABEL: Readonly<Record<SurfaceFinish, string>> = Object.freeze({
  as_printed: 'As printed',
  sanded: 'Sanded',
  bead_blasted: 'Bead blasted',
  vapour_smoothed: 'Vapour smoothed',
  painted: 'Painted',
});

/** Infill is a percentage, and only a subtractive process has none. */
export const INFILL_MIN = 10;
export const INFILL_MAX = 100;

/** Whether this process is filled at all: machining removes material. */
export const usesInfill = (technology: PrintTechnology): boolean =>
  technology === 'fdm' || technology === 'sla';

export type ManufacturingFileKind = 'pcb' | 'model_3d' | 'document';

const EXTENSION_KIND: Readonly<Record<string, ManufacturingFileKind>> = Object.freeze({
  gbr: 'pcb',
  gtl: 'pcb',
  gbl: 'pcb',
  drl: 'pcb',
  gerber: 'pcb',
  zip: 'pcb',
  stl: 'model_3d',
  step: 'model_3d',
  stp: 'model_3d',
  '3mf': 'model_3d',
  obj: 'model_3d',
  iges: 'model_3d',
  igs: 'model_3d',
  sldprt: 'model_3d',
  f3d: 'model_3d',
  csv: 'document',
  xlsx: 'document',
  pdf: 'document',
  txt: 'document',
  md: 'document',
});

/**
 * What kind of work a file implies.
 *
 * The platform can send a 3D module to manufacture on its own, so the split
 * between board files and model files decides what is being asked for. A
 * gerber archive arrives zipped, which is why .zip reads as a board unless the
 * name says otherwise.
 */
export const fileKindOf = (fileName: string): ManufacturingFileKind => {
  const lower = fileName.toLowerCase();
  const extension = lower.includes('.') ? (lower.split('.').pop() ?? '') : '';
  if (extension === 'zip') {
    if (lower.includes('stl') || lower.includes('step') || lower.includes('model')) {
      return 'model_3d';
    }
    return 'pcb';
  }
  return EXTENSION_KIND[extension] ?? 'document';
};
