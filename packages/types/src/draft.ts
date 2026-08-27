import { z } from 'zod';
import {
  ASSEMBLY_MODES,
  ASSEMBLY_SIDES,
  PACKAGE_KINDS,
  PRINT_TECHNOLOGIES,
  QUOTED_SERVICES,
  SURFACE_FINISHES,
} from '@ideeza/domain';
import {
  idSchema,
  leadTimeDaysSchema,
  postalAddressSchema,
  quantitySchema,
} from './common.js';

export const substitutionPolicySchema = z.enum([
  'not_allowed',
  'with_approval',
  'manufacturer_discretion',
]);

/**
 * The draft a buyer prepares before a request is sent: what to build, from
 * which files, to which requirements and to which destination.
 *
 * It is the same structured boundary the request carries, minus the two things
 * that are only decided when it is sent: which manufacturers receive it, and
 * the commercial terms asked of them.
 */
export const saveDraftSchema = z.object({
  productId: idSchema,
  kind: z.enum(PACKAGE_KINDS),
  includedFileIds: z.array(idSchema).min(1),
  includedBomLineIds: z.array(idSchema),
  quantity: quantitySchema,
  material: z.string().min(1).max(200),
  manufacturingMethod: z.string().min(1).max(300),
  tolerance: z.string().min(1).max(200),
  leadTimeDays: leadTimeDaysSchema,
  shippingRequirement: z.string().min(1).max(300),
  assembly: z.enum(ASSEMBLY_MODES),
  qualityCheckRequirement: z.string().min(1).max(300),
  substitutionPolicy: substitutionPolicySchema,
  notes: z.string().max(4000).optional(),
  deliveryAddress: postalAddressSchema,
  /**
   * The print specification. Optional at the boundary because a board-only
   * package has none; the domain refuses a 3D package that arrives without it.
   */
  printTechnology: z.enum(PRINT_TECHNOLOGIES).optional(),
  printMaterial: z.string().trim().min(1).max(120).optional(),
  printColor: z.string().trim().min(1).max(60).optional(),
  surfaceFinish: z.enum(SURFACE_FINISHES).optional(),
  infillPercent: z.number().int().min(10).max(100).optional(),
});
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

/**
 * Sending a prepared draft: who receives it, and the commercial terms they are
 * asked to answer.
 *
 * The requirements are not repeated here. They are already saved on the draft,
 * and they are snapshotted at the moment the request is sent so that every
 * recipient quotes against byte-identical inputs.
 */
export const sendRequestSchema = z.object({
  rfqId: idSchema,
  /** What the buyer wants priced: at least one service. */
  requestedServices: z.array(z.enum(QUOTED_SERVICES)).min(1),
  manufacturerIds: z.array(idSchema).min(1).max(10),
  /** The quantity the request is for, confirmed on this screen. */
  quantity: quantitySchema,
  volumeTiers: z.array(quantitySchema).max(5).default([]),
  assembly: z.enum(ASSEMBLY_MODES),
  assemblySides: z.enum(ASSEMBLY_SIDES).optional(),
  targetPriceMinor: z.number().int().positive().optional(),
  neededBy: z.coerce.date().optional(),
  responseDeadline: z.coerce.date().optional(),
  notes: z.string().max(4000).optional(),
  deliveryAddress: postalAddressSchema,
});
export type SendRequestInput = z.infer<typeof sendRequestSchema>;
