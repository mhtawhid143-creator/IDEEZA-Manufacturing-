import type { FileFormatGroup } from '@ideeza/domain';

/**
 * A colour per kind of file, from the system's badge families (UIUX-150).
 *
 * PDF red, ZIP purple and CSV green are the three the design names; board
 * artwork and 3D models get their own so the two halves of a combined package
 * can be told apart at a glance.
 *
 * It lives here rather than in either page because two lists show production
 * files — the request's and the order's — and a colour that meant one thing on
 * one and another on the other would be the same fault this review keeps
 * finding: one fact, two readings.
 *
 * The system ships no "category" colour family, so these are badge tones used
 * for identity rather than for state. Recorded in `docs/DESIGN-SYSTEM.md` §11
 * as a gap for the design team.
 */
export const FILE_FORMAT_TONE: Readonly<Record<FileFormatGroup, string>> = Object.freeze({
  document: 'bg-badge-error-bg text-badge-error-text',
  archive: 'bg-badge-brand-bg text-badge-brand-text',
  data: 'bg-badge-success-bg text-badge-success-text',
  board: 'bg-badge-blue-bg text-badge-blue-text',
  model: 'bg-badge-warning-bg text-badge-warning-text',
  image: 'bg-bg-subtle text-text-secondary',
  other: 'bg-bg-subtle text-text-secondary',
});

/** The tile itself, so both lists draw the same square. */
export const FILE_FORMAT_TILE =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-3xs font-bold tracking-caps';
