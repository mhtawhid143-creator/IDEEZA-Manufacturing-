import { InvariantViolationError } from '../errors.js';
import type { ProductionStage } from '../entities/order.js';
import type { OrderStatus, PaymentStatus, ProductionStageKey } from '../status/index.js';
import { stagePosition } from '../production/canonical-stages.js';
import { isFundingSecured } from './order-creation.js';

export interface ProductionStartCheck {
  readonly orderStatus: OrderStatus;
  readonly paymentStatus: PaymentStatus | undefined;
}

/**
 * Production may not begin before the platform holds the funds, and not while
 * the order is still waiting for them.
 */
export const assertProductionMayStart = (check: ProductionStartCheck): void => {
  if (!isFundingSecured(check.paymentStatus)) {
    throw new InvariantViolationError(
      'production-requires-secured-funding',
      `funding is "${check.paymentStatus ?? 'missing'}", so production cannot start`,
    );
  }
  if (check.orderStatus === 'awaiting_payment') {
    throw new InvariantViolationError(
      'production-requires-secured-funding',
      'the order is still awaiting payment',
    );
  }
  if (check.orderStatus === 'cancelled' || check.orderStatus === 'refunded') {
    throw new InvariantViolationError(
      'production-requires-live-order',
      `the order is "${check.orderStatus}"`,
    );
  }
  /*
   * A case freezes the work as well as the money.
   *
   * While a dispute is open, operations may decide the whole amount goes back
   * to the buyer. A shop that keeps advancing stages in the meantime is
   * spending materials and labour on an order it may not be paid for — and it
   * was doing exactly that: the order read "disputed" and every stage control
   * still worked. The claim before it is different, and deliberately not
   * blocked: an unanswered claim is still the shop's own decision to pay or to
   * challenge, and a line that is running should not be stopped by an
   * accusation the shop may be about to disprove.
   */
  if (check.orderStatus === 'disputed') {
    throw new InvariantViolationError(
      'production-held-by-open-case',
      'a case is open on this order, so production is held until it is decided',
    );
  }
};

/**
 * Stages advance in the canonical order: an earlier stage may not be left
 * behind, and a completed stage is never reopened.
 */
export const assertStageProgression = (
  stages: readonly ProductionStage[],
  targetKey: ProductionStageKey,
): void => {
  const target = stages.find((stage) => stage.key === targetKey);
  if (target === undefined) {
    throw new InvariantViolationError(
      'stage-progression',
      `stage "${targetKey}" does not exist on this order`,
    );
  }
  if (target.status === 'completed') {
    throw new InvariantViolationError(
      'stage-progression',
      `stage "${targetKey}" is already completed and cannot be reopened`,
    );
  }
  const targetPosition = stagePosition(targetKey);
  const unfinishedEarlier = stages
    .filter((stage) => stagePosition(stage.key) < targetPosition)
    .filter((stage) => stage.status !== 'completed');
  if (unfinishedEarlier.length > 0) {
    throw new InvariantViolationError(
      'stage-progression',
      `earlier stage "${unfinishedEarlier[0]?.key ?? 'unknown'}" is not completed yet`,
    );
  }
};
