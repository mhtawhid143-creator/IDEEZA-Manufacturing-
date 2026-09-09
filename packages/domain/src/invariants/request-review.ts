import type { PackageKind } from '../entities/product.js';

/**
 * The parts of a request a shop has to have read before it prices the work
 * (UIUX-193).
 *
 * A quote is binding, and accepting one secures the buyer's money. A price put
 * on work nobody opened is therefore not a cheap mistake: it is a dispute with
 * funds already held against it, over a surface finish or an assembly step the
 * shop never saw. So the quote form will not send until the parts that apply to
 * this particular request have each been opened at least once.
 *
 * Deliberately not "whichever tabs exist": only the parts that can actually
 * carry something. A print-only request has no bill of materials, and requiring
 * a shop to open an empty page teaches it that the gate is theatre.
 */
export const REVIEW_SECTIONS = ['files', 'specification', 'bom'] as const;

export type ReviewSection = (typeof REVIEW_SECTIONS)[number];

export const REVIEW_SECTION_LABEL: Readonly<Record<ReviewSection, string>> = Object.freeze(
  {
    files: 'Production files',
    specification: 'Production specification',
    bom: 'BOM / parts',
  },
);

/** Where each part is read, relative to the request. */
export const REVIEW_SECTION_SEGMENT: Readonly<Record<ReviewSection, string>> =
  Object.freeze({
    files: '/files',
    specification: '/specification',
    bom: '/bom',
  });

export interface ReviewWork {
  readonly packageKind: PackageKind;
  /** Whether anything was actually attached to the request. */
  readonly fileCount: number;
  /** Whether the request carries a bill of materials at all. */
  readonly bomLineCount: number;
}

/**
 * Which parts this request can be reviewed against.
 *
 * The specification is always one: every request has requirements, and they are
 * what a price answers. The files and the bill of materials are only required
 * when the request actually has them — a request sent without files is the
 * buyer's own gap, and declining it for incomplete files is the honest answer
 * rather than a gate the shop cannot pass.
 */
export const reviewSectionsFor = (work: ReviewWork): readonly ReviewSection[] => {
  const sections: ReviewSection[] = ['specification'];
  if (work.fileCount > 0) sections.unshift('files');
  if (work.bomLineCount > 0) sections.push('bom');
  return sections;
};

export interface ReviewRecord {
  readonly files: boolean;
  readonly specification: boolean;
  readonly bom: boolean;
}

/**
 * The parts that still have to be read, in the order they are offered.
 *
 * Empty means the quote may be sent. The caller shows this list rather than a
 * bare refusal, because a gate that does not say what it wants is a wall.
 */
export const reviewOutstanding = (
  required: readonly ReviewSection[],
  seen: ReviewRecord,
): readonly ReviewSection[] => required.filter((section) => !seen[section]);
