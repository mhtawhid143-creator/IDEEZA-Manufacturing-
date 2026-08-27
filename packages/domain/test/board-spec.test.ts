import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  assertBoardSpecApplies,
  assertBoardSpecCoherent,
  assertSpecAgreesWithServices,
  specifiedFieldCount,
} from '../src/index.js';

const bare = { assembly: 'none' as const, assemblySides: null };
const assembled = { assembly: 'smt' as const, assemblySides: 'single_side' as const };

describe('when a board specification applies', () => {
  it('applies to a package with a board in it', () => {
    expect(() => assertBoardSpecApplies(['stack.gbr', 'bom.csv'])).not.toThrow();
  });

  it('does not apply to printed parts', () => {
    expect(() => assertBoardSpecApplies(['shell.stl'])).toThrow(
      /no board in it/,
    );
  });
});

describe('a buildable board specification', () => {
  it('accepts a specification that is left open', () => {
    expect(() => assertBoardSpecCoherent({}, bare)).not.toThrow();
  });

  it('refuses values no shop runs', () => {
    expect(() => assertBoardSpecCoherent({ layerCount: 3 }, bare)).toThrow(
      /layer count has to be one of/,
    );
    expect(() => assertBoardSpecCoherent({ thicknessMm: 1.35 }, bare)).toThrow(
      InvariantViolationError,
    );
    expect(() => assertBoardSpecCoherent({ minViaHoleMm: 0.05 }, bare)).toThrow(
      InvariantViolationError,
    );
  });

  it('has no inner copper or buried vias on a two-layer board', () => {
    expect(() =>
      assertBoardSpecCoherent({ layerCount: 2, innerCopperOz: 1 }, bare),
    ).toThrow(/no inner copper/);
    expect(() =>
      assertBoardSpecCoherent({ layerCount: 2, blindOrBuriedVias: true }, bare),
    ).toThrow(/at least four layers/);
    expect(() =>
      assertBoardSpecCoherent({ layerCount: 4, blindOrBuriedVias: true }, bare),
    ).not.toThrow();
  });

  it('keeps a many-layer board thick enough to make', () => {
    expect(() =>
      assertBoardSpecCoherent({ layerCount: 8, thicknessMm: 0.8 }, bare),
    ).toThrow(/at least 1.0mm/);
    expect(() =>
      assertBoardSpecCoherent({ layerCount: 8, thicknessMm: 1.6 }, bare),
    ).not.toThrow();
  });

  it('sends more than one design out as a panel', () => {
    expect(() =>
      assertBoardSpecCoherent({ distinctDesigns: 3, deliveryFormat: 'single_pcb' }, bare),
    ).toThrow(/has to be delivered as a panel/);
    expect(() =>
      assertBoardSpecCoherent(
        { distinctDesigns: 3, deliveryFormat: 'panel_by_manufacturer' },
        bare,
      ),
    ).not.toThrow();
    expect(() => assertBoardSpecCoherent({ distinctDesigns: 40 }, bare)).toThrow(
      /at most 8 different designs/,
    );
  });

  it('refuses assembly answers on a request that asks for no assembly', () => {
    expect(() => assertBoardSpecCoherent({ partsSuppliedBy: 'manufacturer' }, bare)).toThrow(
      /asks for no assembly/,
    );
    expect(() => assertBoardSpecCoherent({ conformalCoating: true }, bare)).toThrow(
      /part of assembly/,
    );
    expect(() =>
      assertBoardSpecCoherent({ partsSuppliedBy: 'manufacturer' }, assembled),
    ).not.toThrow();
  });

  it('refuses a stencil when the manufacturer is doing the assembly', () => {
    expect(() => assertBoardSpecCoherent({ stencilRequired: true }, assembled)).toThrow(
      /populating the board yourself/,
    );
    expect(() => assertBoardSpecCoherent({ stencilRequired: true }, bare)).not.toThrow();
  });

  it('does not name one face when both are being populated', () => {
    expect(() =>
      assertBoardSpecCoherent({ assembledFace: 'top' }, {
        assembly: 'smt',
        assemblySides: 'double_side',
      }),
    ).toThrow(/single assembled face/);
  });
});

describe('the specification and the services asked for', () => {
  it('needs parts sourcing quoted when the manufacturer supplies the parts', () => {
    expect(() =>
      assertSpecAgreesWithServices({ partsSuppliedBy: 'manufacturer' }, ['pcb_assembly']),
    ).toThrow(/parts sourcing has to be quoted/);
    expect(() =>
      assertSpecAgreesWithServices({ partsSuppliedBy: 'manufacturer' }, [
        'pcb_assembly',
        'parts_sourcing',
      ]),
    ).not.toThrow();
  });

  it('needs the stencil quoted when the specification asks for one', () => {
    expect(() =>
      assertSpecAgreesWithServices({ stencilRequired: true }, ['pcb_fabrication']),
    ).toThrow(/stencil/);
    expect(() =>
      assertSpecAgreesWithServices({ stencilRequired: true }, [
        'pcb_fabrication',
        'stencil',
      ]),
    ).not.toThrow();
  });

  it('says nothing when the buyer supplies the parts themselves', () => {
    expect(() =>
      assertSpecAgreesWithServices({ partsSuppliedBy: 'buyer' }, ['pcb_assembly']),
    ).not.toThrow();
  });
});

describe('how much of it is pinned down', () => {
  it('counts only the answers the buyer actually gave', () => {
    expect(
      specifiedFieldCount({
        requirementsId: 'req_1',
        createdAt: new Date(),
        updatedAt: new Date(),
        layerCount: 4,
        surfaceFinish: 'enig',
        goldFingers: false,
        remarks: '',
        boardColor: null,
      }),
    ).toBe(2);
  });
});
