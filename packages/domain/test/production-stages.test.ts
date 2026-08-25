import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STAGE_TASK_TEMPLATES,
  InvalidTransitionError,
  InvariantViolationError,
  applyTransition,
  assertStageProgression,
  nextStageKey,
  productionProgressMachine,
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

  it('keeps shop-floor detail as tasks under a canonical stage', () => {
    expect(DEFAULT_STAGE_TASK_TEMPLATES.in_production).toContain('Assembly');
    expect(DEFAULT_STAGE_TASK_TEMPLATES.quality_check).toContain('Functional test');
    expect(Object.keys(DEFAULT_STAGE_TASK_TEMPLATES).every((key) => {
      return stageDefinition(key as never) !== undefined;
    })).toBe(true);
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
