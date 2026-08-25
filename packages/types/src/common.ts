import { z } from 'zod';

/** Identifiers cross the boundary as plain strings and are branded inside. */
export const idSchema = z.string().min(1).max(64);

export const isoTimestampSchema = z.string().datetime({ offset: true });

export const currencySchema = z.string().length(3).toUpperCase();

export const moneySchema = z.object({
  amountMinor: z.number().int(),
  currency: currencySchema,
});
export type MoneyInput = z.infer<typeof moneySchema>;

export const positiveMoneySchema = moneySchema.extend({
  amountMinor: z.number().int().nonnegative(),
});

export const postalAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().min(1).optional(),
  city: z.string().min(1),
  region: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),
  countryCode: z.string().length(2).toUpperCase(),
});
export type PostalAddressInput = z.infer<typeof postalAddressSchema>;

export const quantitySchema = z.number().int().positive();
export const leadTimeDaysSchema = z.number().int().positive().max(3650);
