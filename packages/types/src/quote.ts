import { z } from 'zod';
import {
  idSchema,
  isoTimestampSchema,
  leadTimeDaysSchema,
  moneySchema,
  positiveMoneySchema,
  quantitySchema,
} from './common.js';

export const quoteLineSchema = z.object({
  rfqItemId: idSchema.optional(),
  description: z.string().min(1),
  quantity: quantitySchema,
  unitPrice: positiveMoneySchema,
  lineTotal: positiveMoneySchema,
});

export const substitutionSuggestionSchema = z.object({
  rfqItemId: idSchema,
  requestedPartReference: z.string().min(1),
  suggestedPartName: z.string().min(1),
  suggestedInventoryItemId: idSchema.optional(),
  technicalJustification: z.string().min(10),
  priceImpact: moneySchema,
  leadTimeImpactDays: z.number().int(),
});
export type SubstitutionSuggestionInput = z.infer<typeof substitutionSuggestionSchema>;

/**
 * A quote must carry every term the buyer needs in order to compare it.
 *
 * Shipping and terms are required rather than optional so the comparison never
 * has to guess, and so a chat message can never stand in for a quote.
 */
export const submitQuoteSchema = z.object({
  rfqId: idSchema,
  quantity: quantitySchema,
  unitPrice: positiveMoneySchema,
  totalPrice: positiveMoneySchema,
  toolingSetupCost: positiveMoneySchema.optional(),
  shippingEstimate: positiveMoneySchema,
  leadTimeDays: leadTimeDaysSchema,
  materialProcessNotes: z.string().min(1).max(4000),
  warrantyTerms: z.string().max(4000).optional(),
  terms: z.string().min(1).max(8000),
  attachmentIds: z.array(idSchema).max(20).default([]),
  expiresAt: isoTimestampSchema,
  lines: z.array(quoteLineSchema).default([]),
  substitutions: z.array(substitutionSuggestionSchema).default([]),
});
export type SubmitQuoteInput = z.infer<typeof submitQuoteSchema>;

export const reviseQuoteSchema = submitQuoteSchema
  .partial({
    quantity: true,
    unitPrice: true,
    totalPrice: true,
    shippingEstimate: true,
    leadTimeDays: true,
    materialProcessNotes: true,
    terms: true,
    expiresAt: true,
  })
  .extend({
    quoteId: idSchema,
    revisionNote: z.string().max(2000).optional(),
  });

export const requestQuoteRevisionSchema = z.object({
  quoteId: idSchema,
  note: z.string().min(1).max(2000),
});

export const decideSubstitutionSchema = z.object({
  substitutionId: idSchema,
  decision: z.enum(['approved', 'rejected']),
  note: z.string().max(2000).optional(),
});
export type DecideSubstitutionInput = z.infer<typeof decideSubstitutionSchema>;

/**
 * Accepting a quote is a commitment to buy, not an order.
 *
 * The caller must acknowledge that funding still has to be secured, which keeps
 * the buyer-facing wording honest.
 */
export const acceptQuoteSchema = z.object({
  quoteId: idSchema,
  acknowledgesPaymentRequired: z.literal(true),
});
export type AcceptQuoteInput = z.infer<typeof acceptQuoteSchema>;

export const rejectQuoteSchema = z.object({
  quoteId: idSchema,
  note: z.string().max(2000).optional(),
});
