import { PRODUCTION_STAGES, type ProductionStageKey } from '../status/index.js';

export interface CanonicalStageDefinition {
  readonly key: ProductionStageKey;
  readonly position: number;
  readonly label: string;
  /** Who is expected to move this stage forward. */
  readonly advancedBy: 'system' | 'manufacturer' | 'buyer';
  /** True when the stage represents physical work on the shop floor. */
  readonly requiresSecuredFunding: boolean;
}

export const CANONICAL_STAGES: readonly CanonicalStageDefinition[] = Object.freeze([
  {
    key: 'quote_accepted',
    position: 1,
    label: 'Quote accepted',
    advancedBy: 'system',
    requiresSecuredFunding: false,
  },
  {
    key: 'payment_secured',
    position: 2,
    label: 'Payment secured',
    advancedBy: 'system',
    requiresSecuredFunding: false,
  },
  {
    key: 'files_under_review',
    position: 3,
    label: 'Files under review',
    advancedBy: 'manufacturer',
    requiresSecuredFunding: true,
  },
  {
    key: 'materials_confirmed',
    position: 4,
    label: 'Materials / parts confirmed',
    advancedBy: 'manufacturer',
    requiresSecuredFunding: true,
  },
  {
    key: 'in_production',
    position: 5,
    label: 'In production',
    advancedBy: 'manufacturer',
    requiresSecuredFunding: true,
  },
  {
    key: 'quality_check',
    position: 6,
    label: 'Quality check',
    advancedBy: 'manufacturer',
    requiresSecuredFunding: true,
  },
  {
    key: 'ready_to_ship',
    position: 7,
    label: 'Ready to ship',
    advancedBy: 'manufacturer',
    requiresSecuredFunding: true,
  },
  {
    key: 'shipped',
    position: 8,
    label: 'Shipped',
    advancedBy: 'manufacturer',
    requiresSecuredFunding: true,
  },
  {
    key: 'delivered',
    position: 9,
    label: 'Delivered',
    advancedBy: 'manufacturer',
    requiresSecuredFunding: true,
  },
  {
    key: 'completed',
    position: 10,
    label: 'Completed',
    advancedBy: 'system',
    requiresSecuredFunding: true,
  },
] satisfies readonly CanonicalStageDefinition[]);

export const stageDefinition = (key: ProductionStageKey): CanonicalStageDefinition => {
  const found = CANONICAL_STAGES.find((stage) => stage.key === key);
  if (!found) throw new Error(`Unknown production stage: ${key}`);
  return found;
};

export const stagePosition = (key: ProductionStageKey): number =>
  stageDefinition(key).position;

export const nextStageKey = (key: ProductionStageKey): ProductionStageKey | undefined =>
  PRODUCTION_STAGES[stagePosition(key)];
