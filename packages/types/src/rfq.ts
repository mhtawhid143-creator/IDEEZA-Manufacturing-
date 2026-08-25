import { z } from 'zod';
import { ASSEMBLY_MODES, PACKAGE_KINDS } from '@ideeza/domain';
import {
  idSchema,
  isoTimestampSchema,
  leadTimeDaysSchema,
  moneySchema,
  postalAddressSchema,
  quantitySchema,
} from './common.js';
import { rfqDeclineReasonSchema } from './status.js';

export const bomLineSchema = z.object({
  reference: z.string().min(1),
  componentName: z.string().min(1),
  manufacturerPartNumber: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  quantityPerUnit: quantitySchema,
});

export const fileRefSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  revision: z.number().int().nonnegative(),
  contentHash: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  uploadedAt: isoTimestampSchema,
});

/**
 * Structured production requirements.
 *
 * Every field is required because a vague work boundary is exactly what makes a
 * manufacturing dispute unresolvable; free text is limited to notes.
 */
export const manufacturingRequirementsSchema = z.object({
  files: z.array(fileRefSchema).min(1),
  bom: z.array(bomLineSchema),
  quantity: quantitySchema,
  material: z.string().min(1),
  manufacturingMethod: z.string().min(1),
  tolerance: z.string().min(1),
  leadTimeDays: leadTimeDaysSchema,
  shippingRequirement: z.string().min(1),
  assembly: z.enum(ASSEMBLY_MODES),
  qualityCheckRequirement: z.string().min(1),
  substitutionPolicy: z.enum([
    'not_allowed',
    'with_approval',
    'manufacturer_discretion',
  ]),
  notes: z.string().max(4000).optional(),
});
export type ManufacturingRequirementsInput = z.infer<
  typeof manufacturingRequirementsSchema
>;

export const manufacturingPackageSchema = z.object({
  productId: idSchema,
  kind: z.enum(PACKAGE_KINDS),
  includedFileIds: z.array(idSchema).min(1),
});

/**
 * One request, routed to one or many manufacturers.
 *
 * Multiple recipients never mean multiple orders: they mean competing responses
 * for the buyer to compare.
 */
export const submitRfqSchema = z.object({
  packageId: idSchema,
  requirements: manufacturingRequirementsSchema,
  quantity: quantitySchema,
  volumeTiers: z.array(quantitySchema).max(5).default([]),
  targetPrice: moneySchema.optional(),
  deliveryAddress: postalAddressSchema,
  neededBy: isoTimestampSchema.optional(),
  responseDeadline: isoTimestampSchema.optional(),
  manufacturerIds: z.array(idSchema).min(1).max(10),
});
export type SubmitRfqInput = z.infer<typeof submitRfqSchema>;

export const withdrawRfqSchema = z.object({
  rfqId: idSchema,
  reason: z.string().max(1000).optional(),
});

export const declineRfqSchema = z.object({
  rfqId: idSchema,
  reason: rfqDeclineReasonSchema,
  note: z.string().max(1000).optional(),
});
export type DeclineRfqInput = z.infer<typeof declineRfqSchema>;
