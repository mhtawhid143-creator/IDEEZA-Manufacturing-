import { InvariantViolationError } from '../errors.js';
import type { Payout } from '../entities/settlement.js';
import type { DomainEvent } from '../events/domain-event.js';
import { isPayoutReleaseTrigger } from '../events/kinds.js';
import { payoutMachine, type PayoutTransitionContext } from '../machines/settlement.js';
import { applyTransition } from '../machines/state-machine.js';
import type { IsoTimestamp } from '../ids.js';

export interface PayoutReleaseInput {
  readonly payout: Payout;
  readonly triggerEvent: DomainEvent;
  readonly hasOpenDispute?: boolean | undefined;
  readonly releasedAt: IsoTimestamp;
}

/**
 * Releases money to the manufacturer against a documented order event.
 *
 * Delivery confirmation, review window expiry, accepted inspection evidence, an
 * agreed partial refund and a resolved dispute are the only justifications.
 */
export const releasePayout = (input: PayoutReleaseInput): Payout => {
  const { payout, triggerEvent } = input;

  if (!isPayoutReleaseTrigger(triggerEvent.kind)) {
    throw new InvariantViolationError(
      'payout-release-requires-documented-event',
      `event "${triggerEvent.kind}" does not justify releasing money`,
    );
  }
  if (triggerEvent.orderId !== undefined && triggerEvent.orderId !== payout.orderId) {
    throw new InvariantViolationError(
      'payout-release-requires-documented-event',
      'the release trigger belongs to a different order',
    );
  }

  const context: PayoutTransitionContext = {
    releaseTriggerEventKind: triggerEvent.kind,
    releaseTriggerEventId: triggerEvent.id,
    hasOpenDispute: input.hasOpenDispute,
  };

  const status = applyTransition(payoutMachine, payout.status, 'released', context);

  return Object.freeze({
    ...payout,
    status,
    releaseTriggerEventId: triggerEvent.id,
    releasedAt: input.releasedAt,
  } satisfies Payout);
};

/** Read-only check used by the operations queue before offering the action. */
export const payoutReleaseBlockedReason = (
  input: Omit<PayoutReleaseInput, 'releasedAt'>,
): string | undefined => {
  try {
    releasePayout({ ...input, releasedAt: '1970-01-01T00:00:00.000Z' as IsoTimestamp });
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : 'payout cannot be released';
  }
};
