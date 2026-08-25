import { z } from 'zod';
import { idSchema, isoTimestampSchema } from './common.js';
import { productionProgressStatusSchema, productionStageKeySchema } from './status.js';

export const productionStageSchema = z.object({
  id: idSchema,
  orderId: idSchema,
  key: productionStageKeySchema,
  position: z.number().int().min(1).max(10),
  status: productionProgressStatusSchema,
  startedAt: isoTimestampSchema.optional(),
  completedAt: isoTimestampSchema.optional(),
  note: z.string().max(2000).optional(),
});
export type ProductionStageView = z.infer<typeof productionStageSchema>;

/**
 * Shop-floor detail lives in tasks under a canonical stage, which is how the
 * manufacturer panel can be granular while both sides read one lifecycle.
 */
export const productionTaskSchema = z.object({
  id: idSchema,
  orderId: idSchema,
  stageKey: productionStageKeySchema,
  label: z.string().min(1).max(120),
  position: z.number().int().nonnegative(),
  status: productionProgressStatusSchema,
  startedAt: isoTimestampSchema.optional(),
  completedAt: isoTimestampSchema.optional(),
});

export const updateStageProgressSchema = z.object({
  orderId: idSchema,
  stageKey: productionStageKeySchema,
  status: z.enum(['in_progress', 'completed']),
  note: z.string().max(2000).optional(),
});
export type UpdateStageProgressInput = z.infer<typeof updateStageProgressSchema>;

export const updateTaskProgressSchema = z.object({
  orderId: idSchema,
  taskId: idSchema,
  status: z.enum(['in_progress', 'completed']),
});
