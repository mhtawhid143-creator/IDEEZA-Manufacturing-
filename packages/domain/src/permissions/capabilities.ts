/**
 * Every capability the two panels expose, named after the business action.
 *
 * The list exists so that authorisation is a lookup against one table rather
 * than a scatter of screen-level checks, and so a capability that belongs to one
 * domain can never be rendered by the other.
 */
export const CAPABILITIES = [
  'rfq.create',
  'rfq.withdraw',
  'rfq.view',
  'rfq.decline',
  'quote.create',
  'quote.revise',
  'quote.view',
  'quote.accept',
  'quote.reject',
  'substitution.suggest',
  'substitution.decide',
  'checkout.pay',
  'order.view',
  'production.update',
  'cancellation.request',
  'cancellation.decide',
  'delivery.confirm',
  'refund.request',
  'refund.respond',
  'refund.decide',
  'dispute.open',
  'dispute.resolve',
  'payout.release',
  'payout.withdraw',
  'inventory.read',
  'inventory.write',
  'messaging.participate',
  'evidence.read',
  'evidence.write',
  'review.publish',
] as const;
export type Capability = (typeof CAPABILITIES)[number];
