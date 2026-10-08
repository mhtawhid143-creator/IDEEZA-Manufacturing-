import { describe, expect, it } from 'vitest';
import { manufacturingTypeLabel, PACKAGE_KIND_LABEL } from '../src/index.js';

/**
 * UIUX-136. The row headed "Manufacturing type" showed only what the package is
 * made of — "PCB" — and left out the work being asked for on it. A board that
 * has to be fabricated and a board that has to be fabricated *and populated*
 * are two different jobs, two different prices and two different shops, and the
 * row that names the job said the same word for both.
 */
describe('the full manufacturing type', () => {
  it('says fabrication alone when no parts are being placed', () => {
    expect(
      manufacturingTypeLabel({ packageKind: 'pcb', assemblyAsked: false }),
    ).toBe('PCB');
  });

  it('names the assembly when the buyer asked for it', () => {
    expect(manufacturingTypeLabel({ packageKind: 'pcb', assemblyAsked: true })).toBe(
      'PCB + assembly',
    );
  });

  it('says printing on its own, which takes no assembly', () => {
    expect(
      manufacturingTypeLabel({ packageKind: 'module_3d', assemblyAsked: false }),
    ).toBe('3D printing');
  });

  it('lists both kinds of work on a combined package', () => {
    expect(
      manufacturingTypeLabel({ packageKind: 'full_product', assemblyAsked: false }),
    ).toBe('PCB + 3D printing');
  });

  it('lists all three when a combined package is assembled too', () => {
    expect(
      manufacturingTypeLabel({ packageKind: 'full_product', assemblyAsked: true }),
    ).toBe('PCB + assembly + 3D printing');
  });

  it('keeps the package vocabulary UIUX-144 settled, rather than inventing a second', () => {
    // Every label still opens with the words the package kind is known by, so
    // the inbox filter — which filters by kind — still reads as the same
    // vocabulary as the row it narrows.
    for (const kind of ['pcb', 'module_3d', 'full_product'] as const) {
      expect(
        manufacturingTypeLabel({ packageKind: kind, assemblyAsked: false }),
      ).toBe(PACKAGE_KIND_LABEL[kind]);
    }
  });

  it('never says assembly on work that has no board to populate', () => {
    // Assembly is placing parts on a board. A printed part has no such step,
    // so the flag cannot add one — the row would be describing a stage the
    // shop is not being asked to run.
    expect(
      manufacturingTypeLabel({ packageKind: 'module_3d', assemblyAsked: true }),
    ).toBe('3D printing');
  });
});
