import { z } from 'zod';
import { idSchema, isoTimestampSchema, moneySchema, postalAddressSchema } from './common.js';
import { orderStatusSchema } from './status.js';

/** Read model of the frozen terms an order was created from. */
export const acceptedQuoteSnapshotSchema = z.object({
  quoteId: idSchema,
  quoteVersion: z.number().int().nonnegative(),
  manufacturerId: idSchema,
  quantity: z.number().int().positive(),
  unitPrice: moneySchema,
  totalPrice: moneySchema,
  shippingEstimate: moneySchema.optional(),
  toolingSetupCost: moneySchema.optional(),
  leadTimeDays: z.number().int().positive(),
  materialProcessNotes: z.string(),
  warrantyTerms: z.string().optional(),
  terms: z.string(),
  approvedSubstitutionIds: z.array(idSchema),
  capturedAt: isoTimestampSchema,
  checksum: z.string().min(1),
});

export const manufacturingOrderSchema = z.object({
  id: idSchema,
  rfqId: idSchema,
  buyerId: idSchema,
  manufacturerId: idSchema,
  status: orderStatusSchema,
  acceptedQuote: acceptedQuoteSnapshotSchema,
  paymentId: idSchema.optional(),
  deliveryAddress: postalAddressSchema,
  reviewWindowEndsAt: isoTimestampSchema.optional(),
  confirmedAt: isoTimestampSchema.optional(),
  deliveredAt: isoTimestampSchema.optional(),
  completedAt: isoTimestampSchema.optional(),
  createdAt: isoTimestampSchema,
});
export type ManufacturingOrderView = z.infer<typeof manufacturingOrderSchema>;

export const confirmDeliverySchema = z.object({
  orderId: idSchema,
  note: z.string().max(2000).optional(),
});

export const requestCancellationSchema = z.object({
  orderId: idSchema,
  reason: z.string().min(1).max(2000),
});
