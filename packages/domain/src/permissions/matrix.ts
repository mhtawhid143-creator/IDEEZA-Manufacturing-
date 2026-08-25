import type { ActorRole } from '../status/index.js';
import { CAPABILITIES, type Capability } from './capabilities.js';

const BUYER: ActorRole = 'buyer';
const MANUFACTURER: ActorRole = 'manufacturer';
const OPS: ActorRole = 'ops_admin';

/**
 * Deny by default: a role holds a capability only if it is listed here.
 *
 * Notable asymmetries, all of them deliberate:
 *  - a manufacturer never creates or accepts a request, and never sees stock or
 *    money that is not its own;
 *  - a buyer never quotes, never updates production and never sees any
 *    manufacturer inventory;
 *  - no role but operations may cancel, decide a refund, resolve a dispute or
 *    release money.
 */
export const PERMISSION_MATRIX: Readonly<Record<Capability, readonly ActorRole[]>> =
  Object.freeze({
    'rfq.create': [BUYER],
    'rfq.withdraw': [BUYER],
    'rfq.view': [BUYER, MANUFACTURER, OPS],
    'rfq.decline': [MANUFACTURER],
    'quote.create': [MANUFACTURER],
    'quote.revise': [MANUFACTURER],
    'quote.view': [BUYER, MANUFACTURER, OPS],
    'quote.accept': [BUYER],
    'quote.reject': [BUYER],
    'substitution.suggest': [MANUFACTURER],
    'substitution.decide': [BUYER],
    'checkout.pay': [BUYER],
    'order.view': [BUYER, MANUFACTURER, OPS],
    'production.update': [MANUFACTURER],
    'cancellation.request': [BUYER, MANUFACTURER],
    'cancellation.decide': [OPS],
    'delivery.confirm': [BUYER],
    'refund.request': [BUYER],
    'refund.respond': [MANUFACTURER],
    'refund.decide': [OPS],
    'dispute.open': [BUYER, MANUFACTURER],
    'dispute.resolve': [OPS],
    'payout.release': [OPS],
    'payout.withdraw': [MANUFACTURER],
    'inventory.read': [MANUFACTURER, OPS],
    'inventory.write': [MANUFACTURER],
    'messaging.participate': [BUYER, MANUFACTURER, OPS],
    'evidence.read': [BUYER, MANUFACTURER, OPS],
    'evidence.write': [BUYER, MANUFACTURER, OPS],
    'review.publish': [BUYER],
  } satisfies Record<Capability, readonly ActorRole[]>);

/** Capabilities a role holds, useful for building navigation from the matrix. */
export const capabilitiesFor = (role: ActorRole): readonly Capability[] =>
  CAPABILITIES.filter((capability) => PERMISSION_MATRIX[capability].includes(role));
