import { describe, expect, it } from 'vitest';
import { counted, unitFor } from '../src/index.js';

/**
 * UIUX-137. Screens wrote their own unit beside a count — `${quantity} units`,
 * `${count} Part` — and each of those is wrong for exactly one value. "1 units"
 * reads as a bug in the number and "20 Part" as a bug in the label, and either
 * makes a reader doubt the figure beside it.
 */
describe('a count and its unit', () => {
  it('agrees with itself at one, and above it', () => {
    expect(counted(1, 'unit')).toBe('1 unit');
    expect(counted(12, 'unit')).toBe('12 units');
    expect(counted(20, 'part')).toBe('20 parts');
    expect(counted(38, 'project')).toBe('38 projects');
  });

  it('says none rather than falling back to the singular', () => {
    // Zero takes the plural in English — "0 units", not "0 unit".
    expect(counted(0, 'unit')).toBe('0 units');
    expect(counted(0, 'part')).toBe('0 parts');
  });

  it('takes an irregular plural where adding an s would be wrong', () => {
    expect(counted(1, 'entry', 'entries')).toBe('1 entry');
    expect(counted(4, 'entry', 'entries')).toBe('4 entries');
  });

  it('gives the unit alone, for a header or a sentence that counts elsewhere', () => {
    expect(unitFor(1, 'file')).toBe('file');
    expect(unitFor(3, 'file')).toBe('files');
    expect(unitFor(2, 'entry', 'entries')).toBe('entries');
  });
});
