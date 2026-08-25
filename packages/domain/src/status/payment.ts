/** Buyer funding held by the platform until a release condition is met. */
export const PAYMENT_STATUSES = [
  'initiated',
  'secured',
  'released',
  'refunded',
  'partially_refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Manufacturer-side view of the same money. */
export const PAYOUT_STATUSES = [
  'pending_release',
  'released',
  'refunded',
  'disputed',
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/** Manufacturer moving released balance out of the platform. */
export const WITHDRAWAL_STATUSES = ['requested', 'paid', 'rejected'] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];
