import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_KINDS,
  CAPABILITY_KIND_OPTIONS,
  findCapabilityKind,
} from '../src/data/capability-fields.js';

/**
 * The table the capability form and the capability card both read.
 *
 * It is worth its own test because it is the join between two screens: the
 * popup asks a question under `formLabel`, the card prints the answer under
 * `cardLabel`, and the answer is read back into the form by matching that
 * second label. A duplicate label or a chip list with no options breaks the
 * round trip in a way no type can catch.
 */
describe('the capability field table', () => {
  it('covers the five kinds the design draws a form for', () => {
    expect(CAPABILITY_KINDS.map((entry) => entry.kind)).toEqual([
      'pcb_fabrication',
      'pcb_assembly',
      'printing_3d',
      'cnc_machining',
      'injection_moulding',
    ]);
    expect(CAPABILITY_KIND_OPTIONS).toHaveLength(CAPABILITY_KINDS.length);
  });

  it('gives every kind a card label of its own within the sheet', () => {
    for (const spec of CAPABILITY_KINDS) {
      const labels = spec.fields.map((field) => field.cardLabel);
      // Reading a sheet back into the form matches on this label, so two rows
      // sharing one would fill the second field from the first row's answer.
      expect(new Set(labels).size, spec.label).toBe(labels.length);

      const ids = spec.fields.map((field) => field.id);
      expect(new Set(ids).size, spec.label).toBe(ids.length);
    }
  });

  it('gives every chip and select something to choose from', () => {
    for (const spec of CAPABILITY_KINDS) {
      for (const field of spec.fields) {
        if (field.control === 'text') {
          expect(field.options, `${spec.label} / ${field.formLabel}`).toBeUndefined();
          continue;
        }
        expect(field.options?.length ?? 0, `${spec.label} / ${field.formLabel}`).toBeGreaterThan(1);
        expect(new Set(field.options).size).toBe(field.options?.length);
      }
    }
  });

  it('ends every sheet with the build time, which is what a buyer plans around', () => {
    for (const spec of CAPABILITY_KINDS) {
      expect(spec.fields.at(-1)?.cardLabel, spec.label).toBe('Build time');
    }
  });

  it('finds a kind by name and refuses one it does not have', () => {
    expect(findCapabilityKind('cnc_machining')?.label).toBe('CNC Machining');
    expect(findCapabilityKind('teleportation')).toBeUndefined();
  });
});
