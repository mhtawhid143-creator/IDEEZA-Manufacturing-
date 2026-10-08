/**
 * What kind of file this is, read from its name.
 *
 * The production files list drew one grey glyph on every row, so a shop looking
 * for the Gerber set among nine files had nothing to scan by (UIUX-150). The
 * design answers it with a coloured tile carrying the format — PDF red, ZIP
 * purple, CSV green.
 *
 * That arrangement is what makes colour safe on this tab, and it is worth
 * saying why, because an earlier pass refused colour here and was wrong. The
 * objection was that colour in this portal means state, and a red icon would
 * compete with the red "files did not arrive" alert below the list. What
 * settles it is that the colour marks the *format* while the words beside it
 * say the *role* — "Bill of materials", "Gerber set". Neither is doing the
 * other's job, and a reader looking for a state has words for it.
 *
 * `fileKindOf` in `status/print.ts` answers a different question — whether a
 * file is board work, printed work or a document — and is used to decide which
 * files a request still needs. This is only ever about how a row looks.
 */

export const FILE_FORMAT_GROUPS = [
  'document',
  'archive',
  'data',
  'board',
  'model',
  'image',
  'other',
] as const;
export type FileFormatGroup = (typeof FILE_FORMAT_GROUPS)[number];

export interface FileFormat {
  /** What the tile prints: `PDF`, `ZIP`, `CSV`. */
  readonly label: string;
  readonly group: FileFormatGroup;
}

const GROUP_BY_EXTENSION: Readonly<Record<string, FileFormatGroup>> = Object.freeze({
  pdf: 'document',
  doc: 'document',
  docx: 'document',
  txt: 'document',
  md: 'document',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  csv: 'data',
  xls: 'data',
  xlsx: 'data',
  json: 'data',
  gbr: 'board',
  gtl: 'board',
  gbl: 'board',
  gto: 'board',
  gts: 'board',
  drl: 'board',
  gerber: 'board',
  stl: 'model',
  step: 'model',
  stp: 'model',
  '3mf': 'model',
  obj: 'model',
  iges: 'model',
  igs: 'model',
  sldprt: 'model',
  f3d: 'model',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  svg: 'image',
  webp: 'image',
});

/** How wide a tile can print before it stops being a tile. */
const LABEL_LIMIT = 6;

export const fileFormat = (name: string): FileFormat => {
  // The last dot, because a file is routinely called
  // `IDEEZA-MAIN-PCB-v2.3.1-Gerber.zip` and the first three dots are a version.
  const lastDot = name.lastIndexOf('.');
  const extension = lastDot === -1 ? '' : name.slice(lastDot + 1).toLowerCase();

  if (extension === '') return { label: 'FILE', group: 'other' };

  return {
    label: extension.slice(0, LABEL_LIMIT).toUpperCase(),
    group: GROUP_BY_EXTENSION[extension] ?? 'other',
  };
};
