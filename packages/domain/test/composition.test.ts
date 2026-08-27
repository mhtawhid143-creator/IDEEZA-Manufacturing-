import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  assertAssemblyFitsComposition,
  assertCompositionIsMakeable,
  assertPrintSpecComplete,
  assertServicesFitPackage,
  fileKindOf,
  includesModel3d,
  packageKindForFiles,
  servicesForKind,
} from '../src/index.js';

describe('what a file is for', () => {
  it('reads a board from its gerbers and drill files', () => {
    for (const name of ['stack.gbr', 'top.gtl', 'drills.drl', 'fpv-stack-gerber.zip']) {
      expect(fileKindOf(name)).toBe('pcb');
    }
  });

  it('reads a model from its geometry files', () => {
    for (const name of ['shell.stl', 'housing.step', 'part.3mf', 'bracket.STP']) {
      expect(fileKindOf(name)).toBe('model_3d');
    }
  });

  it('reads everything else as a document', () => {
    for (const name of ['bom.csv', 'drawing.pdf', 'notes.md']) {
      expect(fileKindOf(name)).toBe('document');
    }
  });

  it('reads a zipped model as a model when the name says so', () => {
    expect(fileKindOf('enclosure-stl-set.zip')).toBe('model_3d');
    expect(fileKindOf('gerbers.zip')).toBe('pcb');
  });
});

describe('what is being sent to manufacture', () => {
  it('is a 3D module on its own when only models are included', () => {
    expect(packageKindForFiles(['shell.stl', 'notes.pdf'])).toBe('module_3d');
    expect(includesModel3d(['shell.stl'])).toBe(true);
  });

  it('is a board on its own when only board files are included', () => {
    expect(packageKindForFiles(['stack.gbr', 'bom.csv'])).toBe('pcb');
  });

  it('is the full product when both are included', () => {
    expect(packageKindForFiles(['stack.gbr', 'shell.stl'])).toBe('full_product');
  });

  it('refuses a selection with nothing makeable in it', () => {
    expect(() => assertCompositionIsMakeable([])).toThrow(/at least one file/);
    expect(() => assertCompositionIsMakeable(['bom.csv', 'notes.pdf'])).toThrow(
      /only documents/,
    );
    expect(() => assertCompositionIsMakeable(['shell.stl'])).not.toThrow();
  });

  it('has nothing to assemble without a board', () => {
    expect(() => assertAssemblyFitsComposition(['shell.stl'], 'smt')).toThrow(
      /no board in this package/,
    );
    expect(() => assertAssemblyFitsComposition(['shell.stl'], 'none')).not.toThrow();
    expect(() => assertAssemblyFitsComposition(['stack.gbr'], 'smt')).not.toThrow();
  });
});

describe('what can be quoted for a package', () => {
  it('offers a printer only the work a printed part needs', () => {
    expect(servicesForKind('module_3d')).toEqual(['enclosure_3d', 'testing']);
    expect(() => assertServicesFitPackage('module_3d', ['pcb_assembly'])).toThrow(
      /cannot be quoted for a module 3d package/,
    );
  });

  it('does not offer an enclosure on a board-only package', () => {
    expect(() => assertServicesFitPackage('pcb', ['enclosure_3d'])).toThrow(
      InvariantViolationError,
    );
    expect(() =>
      assertServicesFitPackage('pcb', ['pcb_fabrication', 'pcb_assembly']),
    ).not.toThrow();
  });

  it('offers everything on the full product', () => {
    expect(() =>
      assertServicesFitPackage('full_product', ['pcb_fabrication', 'enclosure_3d']),
    ).not.toThrow();
  });
});

describe('the print specification', () => {
  it('is not asked for when there is no model in the package', () => {
    expect(() => assertPrintSpecComplete(['stack.gbr'], {})).not.toThrow();
  });

  it('needs a process and a material', () => {
    expect(() => assertPrintSpecComplete(['shell.stl'], {})).toThrow(/needs a process/);
    expect(() =>
      assertPrintSpecComplete(['shell.stl'], { printTechnology: 'fdm' }),
    ).toThrow(/needs a material/);
    expect(() =>
      assertPrintSpecComplete(['shell.stl'], {
        printTechnology: 'fdm',
        printMaterial: 'PETG',
      }),
    ).not.toThrow();
  });

  it('refuses a material the process cannot run', () => {
    expect(() =>
      assertPrintSpecComplete(['shell.stl'], {
        printTechnology: 'fdm',
        printMaterial: 'Aluminium 6061',
      }),
    ).toThrow(/cannot be run on fdm/);
  });

  it('refuses infill on a process that has none', () => {
    expect(() =>
      assertPrintSpecComplete(['shell.stl'], {
        printTechnology: 'cnc_machining',
        printMaterial: 'Aluminium 6061',
        infillPercent: 40,
      }),
    ).toThrow(/has no infill/);
  });

  it('keeps infill a whole percentage in range', () => {
    for (const infillPercent of [0, 5, 120, 33.3]) {
      expect(() =>
        assertPrintSpecComplete(['shell.stl'], {
          printTechnology: 'fdm',
          printMaterial: 'PETG',
          infillPercent,
        }),
      ).toThrow(InvariantViolationError);
    }
    expect(() =>
      assertPrintSpecComplete(['shell.stl'], {
        printTechnology: 'fdm',
        printMaterial: 'PETG',
        infillPercent: 20,
      }),
    ).not.toThrow();
  });
});
