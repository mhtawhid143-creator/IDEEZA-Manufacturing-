import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_FILE_LABEL,
  PRODUCTION_FILE_PURPOSE,
  PRODUCTION_FILE_ROLES,
  bomIsRequired,
  productionFileRoleOf,
  requiredProductionFiles,
} from '../src/index.js';

const BOARD_FAB_ONLY = {
  packageKind: 'pcb' as const,
  assemblyAsked: false,
  multiPart: false,
  panelised: false,
};

const roles = (work: Parameters<typeof requiredProductionFiles>[0]): readonly string[] =>
  requiredProductionFiles(work).map((entry) => entry.role);

describe('what a file is for', () => {
  it('reads the role from the name before the extension', () => {
    // A .zip called "gerbers" is gerbers; a .zip called "assembly-pack" is not.
    expect(productionFileRoleOf('rover-gerbers.zip')).toBe('gerber');
    expect(productionFileRoleOf('rover-assembly-pack.zip')).toBe('assembly_drawing');
    expect(productionFileRoleOf('rover-cpl.csv')).toBe('pick_and_place');
    expect(productionFileRoleOf('rover-centroid.txt')).toBe('pick_and_place');
  });

  it('falls back to the extension when the name says nothing', () => {
    expect(productionFileRoleOf('board.gtl')).toBe('gerber');
    expect(productionFileRoleOf('holes.drl')).toBe('drill');
    expect(productionFileRoleOf('bracket.stl')).toBe('model_3d');
    expect(productionFileRoleOf('parts.csv')).toBe('bom');
    expect(productionFileRoleOf('notes.pdf')).toBe('other');
  });

  it('names and explains every role it can return', () => {
    for (const role of PRODUCTION_FILE_ROLES) {
      expect(PRODUCTION_FILE_LABEL[role].length).toBeGreaterThan(0);
      expect(PRODUCTION_FILE_PURPOSE[role].length).toBeGreaterThan(0);
    }
  });
});

describe('what a request ought to carry', () => {
  it('asks a fabrication-only board for the three it cannot be made without', () => {
    expect(roles(BOARD_FAB_ONLY)).toEqual(['gerber', 'drill', 'fabrication_drawing']);
  });

  it('asks for placement files only when parts are being placed', () => {
    const assembled = roles({ ...BOARD_FAB_ONLY, assemblyAsked: true });
    expect(assembled).toContain('pick_and_place');
    expect(assembled).toContain('assembly_drawing');
    expect(assembled).toContain('bom');
    expect(roles(BOARD_FAB_ONLY)).not.toContain('pick_and_place');
  });

  it('asks for a panel drawing only when the buyer supplies the panel', () => {
    expect(roles({ ...BOARD_FAB_ONLY, panelised: true })).toContain('panelisation');
    expect(roles(BOARD_FAB_ONLY)).not.toContain('panelisation');
  });

  it('never asks for a schematic', () => {
    // A circuit design is not a fabrication input, so the platform does not ask
    // a buyer for their IP by default.
    for (const assemblyAsked of [false, true]) {
      for (const panelised of [false, true]) {
        expect(roles({ ...BOARD_FAB_ONLY, assemblyAsked, panelised })).not.toContain(
          'schematic',
        );
      }
    }
  });

  it('prices a printed part on its own file set, with no board files in it', () => {
    const printed = roles({
      packageKind: 'module_3d',
      assemblyAsked: false,
      multiPart: false,
      panelised: false,
    });
    expect(printed).toContain('model_3d');
    expect(printed).toContain('print_specification');
    expect(printed).not.toContain('gerber');
    expect(printed).not.toContain('drill');
    expect(printed).not.toContain('pick_and_place');
  });

  it('marks the printed extras as the buyer’s option rather than a gap', () => {
    const printed = requiredProductionFiles({
      packageKind: 'module_3d',
      assemblyAsked: false,
      multiPart: false,
      panelised: false,
    });
    const optional = printed
      .filter((entry) => entry.requirement === 'if_specified')
      .map((entry) => entry.role);
    expect(optional).toEqual(['orientation_notes', 'finish_specification']);
  });

  it('names the shared bill of materials once on a combined package', () => {
    const both = roles({
      packageKind: 'full_product',
      assemblyAsked: true,
      multiPart: true,
      panelised: false,
    });
    expect(both.filter((role) => role === 'bom').length).toBe(1);
    expect(both).toContain('gerber');
    expect(both).toContain('model_3d');
  });
});

describe('whether a bill of materials is a manufacturing input', () => {
  it('is not, for a fabrication-only board', () => {
    expect(bomIsRequired(BOARD_FAB_ONLY)).toBe(false);
  });

  it('is not, for a single printed piece', () => {
    expect(
      bomIsRequired({
        packageKind: 'module_3d',
        assemblyAsked: false,
        multiPart: false,
        panelised: false,
      }),
    ).toBe(false);
  });

  it('is, once parts are being placed', () => {
    expect(bomIsRequired({ ...BOARD_FAB_ONLY, assemblyAsked: true })).toBe(true);
  });

  it('is, for a printed build of more than one piece', () => {
    expect(
      bomIsRequired({
        packageKind: 'module_3d',
        assemblyAsked: false,
        multiPart: true,
        panelised: false,
      }),
    ).toBe(true);
  });

  it('ignores assembly on a print-only package, and multi-part on a board', () => {
    // Assembly is a board word and multi-part a printing one; reading either
    // across would make a single printed piece ask for a parts list.
    expect(
      bomIsRequired({
        packageKind: 'module_3d',
        assemblyAsked: true,
        multiPart: false,
        panelised: false,
      }),
    ).toBe(false);
    expect(bomIsRequired({ ...BOARD_FAB_ONLY, multiPart: true })).toBe(false);
  });
});
