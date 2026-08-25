import { z } from 'zod';
import { PAYMENT_METHOD_KINDS } from '@ideeza/domain';
import { idSchema, isoTimestampSchema, moneySchema, positiveMoneySchema } from './common.js';
import { paymentStatusSchema, payoutStatusSchema } from './status.js';

/**
 * Secured checkout.
 *
 * The buyer funds an accepted quote and the platform holds the money; the order
 * is only confirmed once this has succeeded.
 */
export const secureCheckoutSchema = z.object({
  quoteId: idSchema,
  method: z.enum(PAYMENT_METHOD_KINDS),
  goodsAmount: positiveMoneySchema,
  shippingAmount: positiveMoneySchema,
  taxAmount: positiveMoneySchema,
  platformFee: positiveMoneySchema,
  totalCharged: positiveMoneySchema,
  shippingAddressId: idSchema.optional(),
  acknowledgesFundsHeldByPlatform: z.literal(true),
});
export type SecureCheckoutInput = z.infer<typeof secureCheckoutSchema>;

export const paymentSchema = z.object({
  id: idSchema,
  quoteId: idSchema,
  orderId: idSchema.optional(),
  buyerId: idSchema,
  status: paymentStatusSchema,
  method: z.enum(PAYMENT_METHOD_KINDS),
  goodsAmount: moneySchema,
  shippingAmount: moneySchema,
  taxAmount: moneySchema,
  platformFee: moneySchema,
  totalCharged: moneySchema,
  securedAt: isoTimestampSchema.optional(),
  releasedAt: isoTimestampSchema.optional(),
  createdAt: isoTimestampSchema,
});
export type PaymentView = z.infer<typeof paymentSchema>;

export const payoutSchema = z.object({
  id: idSchema,
  orderId: idSchema,
  paymentId: idSchema,
  manufacturerId: idSchema,
  status: payoutStatusSchema,
  orderAmount: moneySchema,
  platformFee: moneySchema,
  netAmount: moneySchema,
  releaseTriggerEventId: idSchema.optional(),
  releasedAt: isoTimestampSchema.optional(),
  createdAt: isoTimestampSchema,
});

/** Releasing money requires naming the documented event that justifies it. */
export const releasePayoutSchema = z.object({
  payoutId: idSchema,
  triggerEventId: idSchema,
});
export type ReleasePayoutInput = z.infer<typeof releasePayoutSchema>;
