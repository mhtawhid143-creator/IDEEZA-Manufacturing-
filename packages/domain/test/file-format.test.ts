import { describe, expect, it } from 'vitest';
import { fileFormat, FILE_FORMAT_GROUPS } from '../src/index.js';

/**
 * UIUX-150. The production files list drew one grey glyph for every row, so a
 * shop scanning for the Gerber set among nine files had nothing to scan by.
 * The design answers it with a coloured tile carrying the format — PDF red, ZIP
 * purple, CSV green — beside the role in words.
 *
 * Which is the arrangement that makes colour safe here: it marks what kind of
 * file this is, and the words say what it is for. Neither is doing the other's
 * job.
 */
describe('reading a file’s format from its name', () => {
  it('names the format in capitals, as the tile prints it', () => {
    expect(fileFormat('IDEEZA-Schematic-v2.3.1.pdf').label).toBe('PDF');
    expect(fileFormat('BOM-IDEEZA-Production.csv').label).toBe('CSV');
    expect(fileFormat('IDEEZA-MAIN-PCB-Gerber.zip').label).toBe('ZIP');
  });

  it('groups the three the design colours, exactly as it colours them', () => {
    expect(fileFormat('a.pdf').group).toBe('document');
    expect(fileFormat('a.zip').group).toBe('archive');
    expect(fileFormat('a.csv').group).toBe('data');
  });

  it('knows the formats this platform actually receives', () => {
    expect(fileFormat('top.gbr').group).toBe('board');
    expect(fileFormat('holes.drl').group).toBe('board');
    expect(fileFormat('housing.stl').group).toBe('model');
    expect(fileFormat('housing.step').group).toBe('model');
  });

  it('reads the last extension, not the first dot in a version number', () => {
    // "IDEEZA-MAIN-PCB-v2.3.1-Gerber.zip" has four dots in it.
    expect(fileFormat('IDEEZA-MAIN-PCB-v2.3.1-Gerber.zip').label).toBe('ZIP');
  });

  it('falls back rather than guessing, and never to an empty tile', () => {
    expect(fileFormat('a.wobble').group).toBe('other');
    expect(fileFormat('a.wobble').label).toBe('WOBBLE');
    expect(fileFormat('no-extension-at-all').label).toBe('FILE');
    expect(fileFormat('no-extension-at-all').group).toBe('other');
  });

  it('does not care how the name was typed', () => {
    expect(fileFormat('A.PDF').group).toBe('document');
    expect(fileFormat('A.PDF').label).toBe('PDF');
  });

  it('keeps the tile short enough to sit in one', () => {
    for (const name of ['a.pdf', 'a.gerber', 'a.sldprt', 'a.wobbleverylong']) {
      expect(fileFormat(name).label.length).toBeLessThanOrEqual(6);
    }
  });

  it('has a group for every one it can return', () => {
    expect(FILE_FORMAT_GROUPS).toContain('other');
    for (const name of ['a.pdf', 'a.zip', 'a.csv', 'a.gbr', 'a.stl', 'a.png', 'a.x']) {
      expect(FILE_FORMAT_GROUPS).toContain(fileFormat(name).group);
    }
  });
});
