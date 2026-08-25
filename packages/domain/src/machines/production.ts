import {
  PRODUCTION_PROGRESS_STATUSES,
  type ProductionProgressStatus,
  type ProductionStageKey,
} from '../status/index.js';
import { stageDefinition } from '../production/canonical-stages.js';
import type { StateMachine, TransitionGuard } from './state-machine.js';

export interface ProductionProgressContext {
  readonly stageKey: ProductionStageKey;
  /** Whether platform-secured funding exists for the order. */
  readonly fundingSecured: boolean;
}

/**
 * Physical work may not begin before funding is secured, so any stage marked as
 * shop-floor work is gated on it.
 */
const requireFundingForShopFloorWork: TransitionGuard<
  ProductionProgressStatus,
  ProductionProgressContext
> = (context) => {
  if (!stageDefinition(context.stageKey).requiresSecuredFunding) return null;
  return context.fundingSecured
    ? null
    : 'production work cannot start before funding is secured by the platform';
};

/** Progress only moves forward: a completed stage is never reopened. */
export const productionProgressMachine: StateMachine<
  ProductionProgressStatus,
  ProductionProgressContext
> = {
  name: 'ProductionProgress',
  initial: 'pending',
  states: PRODUCTION_PROGRESS_STATUSES,
  transitions: {
    pending: ['in_progress', 'completed'],
    in_progress: ['completed'],
    completed: [],
  },
  terminal: ['completed'],
  guards: {
    in_progress: [requireFundingForShopFloorWork],
    completed: [requireFundingForShopFloorWork],
  },
};
