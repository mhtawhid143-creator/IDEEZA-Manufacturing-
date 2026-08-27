import { InvariantViolationError } from '../errors.js';
import type { ManufacturerId } from '../ids.js';

/**
 * How many manufacturers one request may be routed to.
 *
 * A request has to reach enough manufacturers to produce a real comparison, and
 * few enough that every recipient is a considered choice rather than a blast.
 */
export const MAX_RFQ_RECIPIENTS = 10;

/**
 * Sending a request means choosing who receives it.
 *
 * Many recipients never mean many orders: they mean competing quotes for one
 * request, of which the buyer may accept exactly one.
 */
export const assertRecipientsSelected = (
  manufacturerIds: readonly ManufacturerId[],
): void => {
  if (manufacturerIds.length === 0) {
    throw new InvariantViolationError(
      'RequestNeedsARecipient',
      'a request has to be sent to at least one manufacturer',
    );
  }
  if (manufacturerIds.length > MAX_RFQ_RECIPIENTS) {
    throw new InvariantViolationError(
      'RequestRecipientLimit',
      `a request may be routed to at most ${MAX_RFQ_RECIPIENTS} manufacturers, not ${manufacturerIds.length}`,
    );
  }
  if (new Set(manufacturerIds).size !== manufacturerIds.length) {
    throw new InvariantViolationError(
      'RequestRecipientsAreDistinct',
      'the same manufacturer cannot receive one request twice',
    );
  }
};

/**
 * Volume tiers are alternative quantities the buyer wants priced, so they have
 * to be real quantities and each has to be different.
 */
export const assertVolumeTiersUsable = (tiers: readonly number[]): void => {
  for (const tier of tiers) {
    if (!Number.isInteger(tier) || tier <= 0) {
      throw new InvariantViolationError(
        'VolumeTiersArePositive',
        `volume tier ${tier} is not a whole number of units above zero`,
      );
    }
  }
  if (new Set(tiers).size !== tiers.length) {
    throw new InvariantViolationError(
      'VolumeTiersAreDistinct',
      'the same volume tier is listed twice',
    );
  }
};

/**
 * A response deadline in the past would close the request before any
 * manufacturer could answer it.
 */
export const assertDeadlineIsInTheFuture = (
  deadline: Date | undefined,
  now: Date,
): void => {
  if (deadline !== undefined && deadline.getTime() <= now.getTime()) {
    throw new InvariantViolationError(
      'ResponseDeadlineIsInTheFuture',
      'the response deadline has already passed',
    );
  }
};
