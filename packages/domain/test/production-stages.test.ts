import { describe, expect, it } from 'vitest';
import {
  InvalidTransitionError,
  InvariantViolationError,
  applyTransition,
  assertStageProgression,
  nextStageKey,
  productionProgressMachine,
  STAGE_CHECK_FAMILY_LABEL,
  stageChecks,
  stageDefinition,
  stagePosition,
} from '@ideeza/domain';
import { buildStages } from './fixtures.js';

describe('canonical stage order', () => {
  it('walks the ten stages in business order', () => {
    expect(stagePosition('quote_accepted')).toBe(1);
    expect(nextStageKey('quote_accepted')).toBe('payment_secured');
    expect(nextStageKey('shipped')).toBe('delivered');
    expect(nextStageKey('completed')).toBeUndefined();
  });

  it('marks shop-floor stages as funding gated', () => {
    expect(stageDefinition('payment_secured').requiresSecuredFunding).toBe(false);
    expect(stageDefinition('in_production').requiresSecuredFunding).toBe(true);
    expect(stageDefinition('quality_check').requiresSecuredFunding).toBe(true);
  });

  it('keeps shop-floor detail as checks under a canonical stage', () => {
    // The detail belongs under a stage, never beside one: both panels read
    // the same order, and a stage the buyer cannot see is a stage that does
    // not exist.
    const labels = stageChecks('quality_check', BOARD).map((check) => check.label);
    expect(labels).toContain('Functional test');
    expect(stageChecks('quote_accepted', BOARD)).toEqual([]);
    expect(stageChecks('completed', BOARD)).toEqual([]);
  });
});

const BOARD = {
  packageKind: 'pcb' as const,
  assemblyAsked: false,
  multiPart: false,
};

const PRINTED = {
  packageKind: 'module_3d' as const,
  assemblyAsked: false,
  multiPart: false,
};

const BOTH = {
  packageKind: 'full_product' as const,
  assemblyAsked: true,
  multiPart: true,
};

describe('the checks a stage is made of', () => {
  it('asks a board about its own gates, and never about supports', () => {
    const labels = stageChecks('in_production', BOARD).map((check) => check.label);
    expect(labels).toContain('Layer stack-up');
    expect(labels).toContain('Solder mask');
    expect(labels).toContain('Surface finish');
    expect(labels).not.toContain('Support removal');
    // Nobody asked for the parts to be placed, so there is nothing to place.
    expect(labels).not.toContain('Part placement');
  });

  it('asks a printed part about printing, and never about a solder mask', () => {
    const labels = stageChecks('in_production', PRINTED).map((check) => check.label);
    expect(labels).toContain('Slicing and print preparation');
    expect(labels).toContain('Support removal');
    expect(labels).not.toContain('Solder mask');
    expect(labels).not.toContain('Drilling');
  });

  it('adds the placement gates only once assembly was asked for', () => {
    const labels = stageChecks('in_production', {
      packageKind: 'pcb',
      assemblyAsked: true,
      multiPart: false,
    }).map((check) => check.label);
    expect(labels).toContain('Part placement');
    expect(labels).toContain('Reflow');
  });

  it('runs the two kinds of work in parallel under one stage', () => {
    // The whole point of UIUX-206: a printed enclosure does not wait for a
    // board to be imaged, so the checks are grouped rather than sequenced,
    // and both families sit under the same stage.
    const checks = stageChecks('in_production', BOTH);
    const families = new Set(checks.map((check) => check.family));
    expect(families.has('board')).toBe(true);
    expect(families.has('printed')).toBe(true);
    expect(checks.length).toBeGreaterThan(
      stageChecks('in_production', BOARD).length,
    );
  });

  it('never says the same check twice', () => {
    // A check that appears in two places can be passed once and read as done
    // in both, which is worse than not having it.
    for (const work of [BOARD, PRINTED, BOTH]) {
      for (const key of ['in_production', 'quality_check', 'materials_confirmed'] as const) {
        const labels = stageChecks(key, work).map((check) => check.label);
        expect(new Set(labels).size).toBe(labels.length);
      }
    }
    // And the electrical test lives on the quality-check stage, not inside
    // production as well.
    expect(
      stageChecks('in_production', BOARD).map((check) => check.label),
    ).not.toContain('Electrical test');
  });

  it('names the families in the words the quote already uses', () => {
    expect(STAGE_CHECK_FAMILY_LABEL.board).toBe('PCB');
    expect(STAGE_CHECK_FAMILY_LABEL.printed).toBe('3D printing');
  });

  it('puts every check in a family the order actually has', () => {
    for (const check of stageChecks('in_production', BOARD)) {
      expect(check.family).not.toBe('printed');
    }
    for (const check of stageChecks('in_production', PRINTED)) {
      expect(check.family).not.toBe('board');
    }
  });
});

describe('stage progression', () => {
  it('refuses to complete a stage while an earlier one is open', () => {
    const stages = buildStages('payment_secured');
    expect(() => assertStageProgression(stages, 'in_production')).toThrow(
      InvariantViolationError,
    );
  });

  it('allows the next stage in sequence', () => {
    const stages = buildStages('materials_confirmed');
    expect(() => assertStageProgression(stages, 'in_production')).not.toThrow();
  });

  it('refuses to reopen a completed stage', () => {
    const stages = buildStages('in_production');
    expect(() => assertStageProgression(stages, 'in_production')).toThrow(
      /already completed/,
    );
  });
});

describe('stage progress machine', () => {
  const funded = { stageKey: 'in_production' as const, fundingSecured: true };
  const unfunded = { stageKey: 'in_production' as const, fundingSecured: false };

  it('moves pending to in_progress to completed when funded', () => {
    expect(applyTransition(productionProgressMachine, 'pending', 'in_progress', funded)).toBe(
      'in_progress',
    );
    expect(
      applyTransition(productionProgressMachine, 'in_progress', 'completed', funded),
    ).toBe('completed');
  });

  it('refuses shop-floor work when funding is not secured', () => {
    expect(() =>
      applyTransition(productionProgressMachine, 'pending', 'in_progress', unfunded),
    ).toThrow(/before funding is secured/);
  });

  it('still allows pre-funding stages to progress', () => {
    expect(
      applyTransition(productionProgressMachine, 'pending', 'completed', {
        stageKey: 'quote_accepted',
        fundingSecured: false,
      }),
    ).toBe('completed');
  });

  it('never reopens a completed stage', () => {
    expect(() =>
      applyTransition(productionProgressMachine, 'completed', 'in_progress', funded),
    ).toThrow(InvalidTransitionError);
  });
});
