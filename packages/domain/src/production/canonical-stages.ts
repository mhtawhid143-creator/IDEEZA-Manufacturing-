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
    label: 'Quote Accepted',
    advancedBy: 'system',
    requiresSecuredFunding: false,
  },
  {
    key: 'payment_secured',
    position: 2,
    label: 'Payment Secured',
    advancedBy: 'system',
    requiresSecuredFunding: false,
  },
  {
    key: 'files_under_review',
    position: 3,
    label: 'Files Under Review',
    advancedBy: 'manufacturer',
    requiresSecuredFunding: true,
  },
  {
    key: 'materials_confirmed',
    position: 4,
    label: 'Materials / Parts Confirmed',
    advancedBy: 'manufacturer',
    requiresSecuredFunding: true,
  },
  {
    key: 'in_production',
    position: 5,
    label: 'In Production',
    advancedBy: 'manufacturer',
    requiresSecuredFunding: true,
  },
  {
    key: 'quality_check',
    position: 6,
    label: 'Quality Check',
    advancedBy: 'manufacturer',
    requiresSecuredFunding: true,
  },
  {
    key: 'ready_to_ship',
    position: 7,
    label: 'Ready to Ship',
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

/**
 * Default shop-floor activities, expressed as tasks under a canonical stage.
 *
 * The manufacturer panel shows this level of detail; the buyer panel shows the
 * canonical stage. Both read the same order, so the detail may never become a
 * stage of its own.
 */
export const DEFAULT_STAGE_TASK_TEMPLATES: Readonly<
  Partial<Record<ProductionStageKey, readonly string[]>>
> = Object.freeze({
  files_under_review: Object.freeze([
    'Design file review',
    'Manufacturability review',
  ]),
  materials_confirmed: Object.freeze([
    'Inventory check',
    'Parts sourcing',
    'Substitution approvals applied',
  ]),
  in_production: Object.freeze([
    'Bare board fabrication',
    'Assembly',
    'Firmware flashing',
    'Enclosure production',
  ]),
  quality_check: Object.freeze(['Optical inspection', 'Functional test']),
  ready_to_ship: Object.freeze(['Packaging', 'Shipping documents']),
});
