import type {
  EvidenceId,
  FileId,
  IsoTimestamp,
  ManufacturerId,
  OrderId,
  ReviewId,
  UserId,
} from '../ids.js';
import type { EvidenceKind } from '../status/index.js';

/**
 * A piece of the documented order record. Evidence is append-only: a correction
 * is a new record, never an edit, because the whole point is that the state of
 * the world at decision time stays reconstructible.
 */
export interface Evidence {
  readonly id: EvidenceId;
  readonly orderId: OrderId;
  readonly kind: EvidenceKind;
  readonly title: string;
  readonly fileId?: FileId | undefined;
  readonly payload?: Readonly<Record<string, unknown>> | undefined;
  readonly submittedById?: UserId | undefined;
  readonly capturedAt: IsoTimestamp;
}

export interface Review {
  readonly id: ReviewId;
  readonly orderId: OrderId;
  readonly manufacturerId: ManufacturerId;
  readonly authorId: UserId;
  readonly rating: number;
  readonly body?: string | undefined;
  readonly anonymous: boolean;
  readonly createdAt: IsoTimestamp;
}
