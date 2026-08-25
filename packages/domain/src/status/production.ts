/**
 * The ten canonical production stages of the approved business model.
 *
 * Both panels render this single vocabulary. Manufacturer-specific activities
 * (bare board fabrication, firmware flashing, enclosure printing) are
 * ProductionTask records nested inside a stage, never new stages.
 */
export const PRODUCTION_STAGES = [
  'quote_accepted',
  'payment_secured',
  'files_under_review',
  'materials_confirmed',
  'in_production',
  'quality_check',
  'ready_to_ship',
  'shipped',
  'delivered',
  'completed',
] as const;
export type ProductionStageKey = (typeof PRODUCTION_STAGES)[number];

/** Progress of a single stage, or of a task nested in a stage. */
export const PRODUCTION_PROGRESS_STATUSES = [
  'pending',
  'in_progress',
  'completed',
] as const;
export type ProductionProgressStatus = (typeof PRODUCTION_PROGRESS_STATUSES)[number];
