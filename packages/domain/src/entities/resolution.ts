import type {
  DisputeId,
  EvidenceId,
  IsoTimestamp,
  OrderId,
  RefundId,
  UserId,
} from '../ids.js';
import type {
  DisputeOutcome,
  DisputeStatus,
  OrderIssueReason,
  RefundStatus,
} from '../status/index.js';
import type { Money } from './money.js';

/**
 * A refund is the financial outcome of an order issue, so it always references
 * the order and carries the evidence the decision was based on.
 */
export interface Refund {
  readonly id: RefundId;
  readonly orderId: OrderId;
  readonly requestedById: UserId;
  readonly status: RefundStatus;
  readonly reason: OrderIssueReason;
  readonly requestedAmount: Money;
  readonly approvedAmount?: Money | undefined;
  readonly description: string;
  readonly evidenceIds: readonly EvidenceId[];
  readonly manufacturerRespondedAt?: IsoTimestamp | undefined;
  readonly decidedAt?: IsoTimestamp | undefined;
  readonly createdAt: IsoTimestamp;
}

/** The process record that resolves a contested order. */
export interface Dispute {
  readonly id: DisputeId;
  readonly orderId: OrderId;
  readonly refundId?: RefundId | undefined;
  readonly openedById: UserId;
  readonly status: DisputeStatus;
  readonly reason: OrderIssueReason;
  readonly claimedAmount: Money;
  readonly evidenceIds: readonly EvidenceId[];
  readonly outcome?: DisputeOutcome | undefined;
  readonly outcomeAmount?: Money | undefined;
  readonly resolvedAt?: IsoTimestamp | undefined;
  readonly createdAt: IsoTimestamp;
}
