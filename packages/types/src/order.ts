import { z } from 'zod';
import { idSchema, isoTimestampSchema, moneySchema, postalAddressSchema } from './common.js';
import { INVENTORY_RESOLUTIONS } from '@ideeza/domain';
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

/**
 * The buyer's answer to a shortage the manufacturer hit in production.
 *
 * The note is optional except when the part is being dropped: removing an item
 * from a frozen order is the one answer the manufacturer cannot act on without
 * being told what to do instead.
 */
export const answerInventoryAlertSchema = z
  .object({
    alertId: idSchema,
    resolution: z.enum(INVENTORY_RESOLUTIONS),
    note: z.string().trim().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.resolution === 'drop_part' && (value.note ?? '').length < 4) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'Say what should happen to the gap this leaves.',
      });
    }
  });
export type AnswerInventoryAlertInput = z.infer<typeof answerInventoryAlertSchema>;

/**
 * A public review of the manufacturer, left by the buyer who received the units.
 *
 * The body is optional: a rating alone is a real answer, and forcing prose would
 * make the ratings less honest, not more.
 */
export const publishReviewSchema = z.object({
  orderId: idSchema,
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(4000).optional(),
  anonymous: z.boolean().default(false),
});
export type PublishReviewInput = z.infer<typeof publishReviewSchema>;
