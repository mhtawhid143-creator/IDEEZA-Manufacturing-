import { describe, expect, it } from 'vitest';
import {
  EMPTY_PRINT_SPECIFICATION,
  InvariantViolationError,
  assertPrintSpecApplies,
  assertPrintSpecCoherent,
  OPEN_ANSWER,
  printSpecificationRows,
  requirementRows,
  type PrintSpecificationDocument,
  type RequirementsDocument,
} from '../src/index.js';

/**
 * UIUX-153 (MFG-49). A printed part had no specification of its own: five
 * answers were appended to the end of the general requirements and everything
 * else a printer needs to price the job — layer height, wall thickness, the
 * size of the thing, how it is supported and which way up it is made — was
 * nowhere. The board had a document. The print gets one too, as its peer.
 */
const spec: PrintSpecificationDocument = {
  technology: 'sla',
  material: 'Tough resin',
  color: 'Matte black',
  surfaceFinish: 'bead_blasted',
  infillPercent: 40,
  layerHeightMm: 0.05,
  infillPattern: 'gyroid',
  wallThicknessMm: 1.6,
  dimensionXMm: 70.17,
  dimensionYMm: 70.2,
  dimensionZMm: 24,
  toleranceMm: 0.1,
  supportStructure: 'soluble',
  orientationRequirement: 'The lens face must not carry supports.',
  durometer: null,
  postProcessing: 'UV cure, 30 minutes',
  certification: null,
};

const rowFor = (
  rows: readonly { readonly label: string; readonly value: string }[],
  label: string,
): string | undefined => rows.find((row) => row.label === label)?.value;

describe('the print specification', () => {
  it('reads every answer a printer prices against', () => {
    const rows = printSpecificationRows(spec);

    expect(rowFor(rows, 'Print process')).toBe('SLA (resin)');
    expect(rowFor(rows, 'Material')).toBe('Tough resin');
    expect(rowFor(rows, 'Colour')).toBe('Matte black');
    expect(rowFor(rows, 'Surface finish')).toBe('Bead blasted');
    expect(rowFor(rows, 'Infill')).toBe('40% gyroid');
    expect(rowFor(rows, 'Layer height')).toBe('0.05mm');
    expect(rowFor(rows, 'Wall thickness')).toBe('1.6mm');
    expect(rowFor(rows, 'Tolerance')).toBe('+/-0.1mm');
    expect(rowFor(rows, 'Support')).toBe('Soluble, dissolved off');
    expect(rowFor(rows, 'Orientation')).toBe('The lens face must not carry supports.');
    expect(rowFor(rows, 'Post-processing')).toBe('UV cure, 30 minutes');
  });

  it('writes the size as a size, with a multiplication sign and one unit', () => {
    // UIUX-155 (MFG-51): an asterisk between two measurements reads as a stray
    // footnote marker, and repeating the unit on each number reads as three
    // separate facts rather than one box.
    expect(rowFor(printSpecificationRows(spec), 'Dimensions')).toBe('70.17 × 70.2 × 24 mm');
  });

  it('says a row is the manufacturer’s call rather than leaving it blank', () => {
    const rows = printSpecificationRows(EMPTY_PRINT_SPECIFICATION);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.value).toBe(OPEN_ANSWER);
  });

  it('leaves out what does not apply rather than asking for a blank answer', () => {
    // Durometer is meaningless on a rigid resin, and a certification nobody
    // asked for is not an open decision — it is simply not part of the job.
    const rows = printSpecificationRows(spec);
    expect(rowFor(rows, 'Durometer')).toBeUndefined();
    expect(rowFor(rows, 'Certification')).toBeUndefined();

    const flexible = printSpecificationRows({
      ...spec,
      technology: 'mjf',
      material: 'TPU',
      durometer: '95A',
      certification: 'RoHS',
    });
    expect(rowFor(flexible, 'Durometer')).toBe('95A');
    expect(rowFor(flexible, 'Certification')).toBe('RoHS');
  });
});

describe('the general requirements, once the print has its own document', () => {
  const requirements: RequirementsDocument = {
    quantity: 25,
    material: 'Resin',
    manufacturingMethod: '3D printing',
    tolerance: '+/-0.1mm',
    leadTimeDays: 14,
    shippingRequirement: 'Courier',
    assembly: 'none',
    assemblySides: null,
    qualityCheckRequirement: 'Dimensional check on 10%',
    substitutionPolicy: 'with_approval',
    notes: null,
    printTechnology: 'sla',
    printMaterial: 'Tough resin',
    printColor: 'Matte black',
    surfaceFinish: 'bead_blasted',
    infillPercent: 40,
  };

  it('stays the brief it was, and does not repeat the print specification', () => {
    // MFG-49 rec. 4: General Information stays light and the specification tab
    // carries the depth. Printing the same five answers in both places is how
    // two screens start disagreeing about one job.
    const rows = requirementRows(requirements);
    const labels = rows.map((row) => row.label);

    expect(labels).toContain('Quantity');
    expect(labels).toContain('Lead time asked for');
    expect(labels).not.toContain('Print process');
    expect(labels).not.toContain('Infill');
  });
});

describe('a buildable print specification', () => {
  const sla = { technology: 'sla' as const, material: 'Tough resin' };

  it('accepts a specification that is left open', () => {
    expect(() => assertPrintSpecCoherent({}, sla)).not.toThrow();
  });

  it('applies only to a package that actually prints something', () => {
    expect(() => assertPrintSpecApplies(['shell.stl'])).not.toThrow();
    expect(() => assertPrintSpecApplies(['stack.gbr', 'bom.csv'])).toThrow(
      /no printed part in it/,
    );
  });

  it('refuses half a bounding box', () => {
    expect(() =>
      assertPrintSpecCoherent({ dimensionXMm: 70, dimensionYMm: 70 }, sla),
    ).toThrow(/all three/);
    expect(() =>
      assertPrintSpecCoherent(
        { dimensionXMm: 70, dimensionYMm: 70, dimensionZMm: 24 },
        sla,
      ),
    ).not.toThrow();
  });

  it('refuses a tolerance or a wall finer than the layer it is built from', () => {
    expect(() =>
      assertPrintSpecCoherent({ layerHeightMm: 0.2, toleranceMm: 0.05 }, sla),
    ).toThrow(InvariantViolationError);
    expect(() =>
      assertPrintSpecCoherent({ layerHeightMm: 0.2, wallThicknessMm: 0.1 }, sla),
    ).toThrow(/thinner than/);
  });

  it('refuses an infill pattern on a process that removes material', () => {
    expect(() =>
      assertPrintSpecCoherent(
        { infillPattern: 'gyroid' },
        { technology: 'cnc_machining', material: 'Aluminium 6061' },
      ),
    ).toThrow(/does not fill a part/);
  });

  it('refuses a Shore hardness on something that is not flexible', () => {
    expect(() => assertPrintSpecCoherent({ durometer: '95A' }, sla)).toThrow(
      /flexible material/,
    );
    expect(() =>
      assertPrintSpecCoherent({ durometer: '95A' }, { technology: 'mjf', material: 'TPU' }),
    ).not.toThrow();
  });
});
