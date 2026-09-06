import { z } from 'zod';
import { INFILL_PATTERNS, SUPPORT_STRUCTURES } from '@ideeza/domain';
import { idSchema } from './common.js';

/**
 * The 3D printing specification as it crosses into the platform.
 *
 * The peer of `saveBoardSpecSchema`, and optional for the same reason: a missing
 * answer means the manufacturer decides, so a buyer is never made to invent a
 * number they do not have. The ranges here are the physical envelope every
 * process this platform routes to can work inside — a 5mm layer is not a
 * preference, it is a mistake, and it costs nothing to refuse it at the door.
 */
export const savePrintSpecSchema = z.object({
  draftId: idSchema,
  layerHeightMm: z.number().min(0.01).max(1).optional(),
  infillPattern: z.enum(INFILL_PATTERNS).optional(),
  wallThicknessMm: z.number().min(0.4).max(20).optional(),
  dimensionXMm: z.number().min(0.1).max(2000).optional(),
  dimensionYMm: z.number().min(0.1).max(2000).optional(),
  dimensionZMm: z.number().min(0.1).max(2000).optional(),
  toleranceMm: z.number().min(0.01).max(5).optional(),
  supportStructure: z.enum(SUPPORT_STRUCTURES).optional(),
  orientationRequirement: z.string().trim().max(2000).optional(),
  durometer: z.string().trim().max(40).optional(),
  postProcessing: z.string().trim().max(2000).optional(),
  certification: z.string().trim().max(200).optional(),
});
export type SavePrintSpecInput = z.infer<typeof savePrintSpecSchema>;
