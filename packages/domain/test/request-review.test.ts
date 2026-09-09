import { describe, expect, it } from 'vitest';
import {
  REVIEW_SECTIONS,
  REVIEW_SECTION_LABEL,
  REVIEW_SECTION_SEGMENT,
  reviewOutstanding,
  reviewSectionsFor,
} from '../src/index.js';

const NOTHING_READ = { files: false, specification: false, bom: false };

describe('what a shop has to read before it prices the work', () => {
  it('always includes the specification, because that is what a price answers', () => {
    for (const kind of ['pcb', 'module_3d', 'full_product'] as const) {
      expect(
        reviewSectionsFor({ packageKind: kind, fileCount: 0, bomLineCount: 0 }),
      ).toContain('specification');
    }
  });

  it('asks for the bill of materials only when there is one', () => {
    // A print-only request has none. Requiring a shop to open an empty page
    // teaches it that the gate is theatre.
    expect(
      reviewSectionsFor({ packageKind: 'module_3d', fileCount: 2, bomLineCount: 0 }),
    ).toEqual(['files', 'specification']);
    expect(
      reviewSectionsFor({ packageKind: 'pcb', fileCount: 2, bomLineCount: 4 }),
    ).toEqual(['files', 'specification', 'bom']);
  });

  it('asks for the files only when the buyer attached some', () => {
    // A request sent without files is the buyer's own gap, and declining it for
    // incomplete files is the honest answer rather than a gate nobody can pass.
    expect(
      reviewSectionsFor({ packageKind: 'pcb', fileCount: 0, bomLineCount: 3 }),
    ).toEqual(['specification', 'bom']);
  });

  it('only ever names the three sections that exist', () => {
    const asked = reviewSectionsFor({
      packageKind: 'full_product',
      fileCount: 6,
      bomLineCount: 12,
    });
    for (const section of asked) {
      expect(REVIEW_SECTIONS).toContain(section);
      expect(REVIEW_SECTION_LABEL[section].length).toBeGreaterThan(0);
      expect(REVIEW_SECTION_SEGMENT[section].startsWith('/')).toBe(true);
    }
  });
});

describe('what is still outstanding', () => {
  it('is everything required, when nothing has been opened', () => {
    const required = reviewSectionsFor({
      packageKind: 'pcb',
      fileCount: 3,
      bomLineCount: 5,
    });
    expect(reviewOutstanding(required, NOTHING_READ)).toEqual(required);
  });

  it('is empty once each required part has been opened', () => {
    const required = reviewSectionsFor({
      packageKind: 'pcb',
      fileCount: 3,
      bomLineCount: 5,
    });
    expect(
      reviewOutstanding(required, { files: true, specification: true, bom: true }),
    ).toEqual([]);
  });

  it('ignores a part that was read but is not required', () => {
    // A shop that opened the BOM on a print-only request has read something
    // that does not gate anything; it must not shorten what does.
    const required = reviewSectionsFor({
      packageKind: 'module_3d',
      fileCount: 1,
      bomLineCount: 0,
    });
    expect(
      reviewOutstanding(required, { files: false, specification: false, bom: true }),
    ).toEqual(['files', 'specification']);
  });

  it('keeps the order the sections are offered in', () => {
    const required = reviewSectionsFor({
      packageKind: 'full_product',
      fileCount: 2,
      bomLineCount: 2,
    });
    expect(reviewOutstanding(required, { files: true, specification: false, bom: false })).toEqual(
      ['specification', 'bom'],
    );
  });
});
