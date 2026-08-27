import { z } from 'zod';
import { PAYMENT_METHOD_KINDS, SHIPPING_CHOICES } from '@ideeza/domain';
import { idSchema, postalAddressSchema } from './common.js';

/** What the buyer confirms before paying: where it ships and how. */
export const confirmCheckoutSchema = z.object({
  orderId: idSchema,
  shippingChoice: z.enum(SHIPPING_CHOICES),
  deliveryAddress: postalAddressSchema,
  promoCode: z.string().trim().min(1).max(40).optional(),
});
export type ConfirmCheckoutInput = z.infer<typeof confirmCheckoutSchema>;

/**
 * Paying an order.
 *
 * Card details are validated but never stored: the platform holds funds, and a
 * card number has no business in this database.
 */
export const payOrderSchema = z
  .object({
    orderId: idSchema,
    method: z.enum(PAYMENT_METHOD_KINDS),
    shippingChoice: z.enum(SHIPPING_CHOICES),
    promoCode: z.string().trim().min(1).max(40).optional(),
    /** Card fields, required when the method is a card. */
    cardName: z.string().trim().min(2).max(120).optional(),
    cardNumber: z
      .string()
      .trim()
      .regex(/^[0-9 ]{12,23}$/, 'That card number is not valid.')
      .optional(),
    cardExpiry: z
      .string()
      .trim()
      .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Use MM/YY.')
      .optional(),
    cardCvc: z
      .string()
      .trim()
      .regex(/^\d{3,4}$/, 'The security code is 3 or 4 digits.')
      .optional(),
    /** Wallet address, required for a stablecoin or platform-token payment. */
    walletAddress: z.string().trim().min(8).max(120).optional(),
    savedMethodId: idSchema.optional(),
    acceptTerms: z.literal(true),
  })
  .superRefine((value, context) => {
    if (value.method === 'card' && value.savedMethodId === undefined) {
      for (const field of ['cardName', 'cardNumber', 'cardExpiry', 'cardCvc'] as const) {
        if (value[field] === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: 'This is needed to take a card payment.',
          });
        }
      }
    }
    if (
      (value.method === 'stablecoin' || value.method === 'platform_token') &&
      value.walletAddress === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['walletAddress'],
        message: 'Connect a wallet to pay this way.',
      });
    }
  });
export type PayOrderInput = z.infer<typeof payOrderSchema>;
