/**
 * What a buyer can ask to have quoted.
 *
 * A request names the work it wants priced, because "quote this board" means
 * something different to a fabricator, an assembler and a test house. The list
 * is the one the request screen offers, and it is what the summary reads back.
 */
export const QUOTED_SERVICES = [
  'pcb_fabrication',
  'parts_sourcing',
  'pcb_assembly',
  'enclosure_3d',
  'stencil',
  'testing',
] as const;
export type QuotedService = (typeof QUOTED_SERVICES)[number];

/**
 * The capability a manufacturer must publish to cover each requested service.
 *
 * Manufacturer capabilities are recorded as service keys on the profile, so the
 * two vocabularies meet here rather than in a screen.
 */
export const SERVICE_CAPABILITY: Readonly<Record<QuotedService, string>> = Object.freeze({
  pcb_fabrication: 'fabrication',
  parts_sourcing: 'parts_sourcing',
  pcb_assembly: 'assembly',
  enclosure_3d: '3d_enclosure',
  stencil: 'fabrication',
  testing: 'testing',
});

/** Whether the board is populated on one side or both. */
export const ASSEMBLY_SIDES = ['single_side', 'double_side'] as const;
export type AssemblySides = (typeof ASSEMBLY_SIDES)[number];
