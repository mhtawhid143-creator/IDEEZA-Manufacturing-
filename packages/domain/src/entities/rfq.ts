import type {
  IsoTimestamp,
  ManufacturerId,
  PackageId,
  RequirementsId,
  RfqId,
  RfqItemId,
  RfqRecipientId,
  UserId,
} from '../ids.js';
import type { RfqDeclineReason, RfqRecipientStatus, RfqStatus } from '../status/index.js';
import type { Money } from './money.js';
import type { PostalAddress } from './party.js';
import type { ManufacturingRequirements } from './product.js';

/**
 * A single request, routed to one or many manufacturers.
 *
 * The requirements are snapshotted onto the RFQ at submit time so that every
 * recipient quotes against byte-identical inputs and the comparison stays fair.
 */
export interface Rfq {
  readonly id: RfqId;
  readonly buyerId: UserId;
  readonly packageId: PackageId;
  readonly requirementsId: RequirementsId;
  readonly requirementsSnapshot: ManufacturingRequirements;
  readonly status: RfqStatus;
  readonly quantity: number;
  readonly volumeTiers: readonly number[];
  readonly targetPrice?: Money | undefined;
  readonly deliveryAddress: PostalAddress;
  readonly neededBy?: IsoTimestamp | undefined;
  readonly responseDeadline?: IsoTimestamp | undefined;
  readonly submittedAt?: IsoTimestamp | undefined;
  readonly closedAt?: IsoTimestamp | undefined;
  readonly createdAt: IsoTimestamp;
}

/**
 * Per-manufacturer routing state. This record, not the RFQ, is what a
 * manufacturer is allowed to read.
 */
export interface RfqRecipient {
  readonly id: RfqRecipientId;
  readonly rfqId: RfqId;
  readonly manufacturerId: ManufacturerId;
  readonly status: RfqRecipientStatus;
  readonly viewedAt?: IsoTimestamp | undefined;
  readonly quotedAt?: IsoTimestamp | undefined;
  readonly declinedAt?: IsoTimestamp | undefined;
  readonly declineReason?: RfqDeclineReason | undefined;
  readonly declineNote?: string | undefined;
  readonly expiresAt?: IsoTimestamp | undefined;
}

/** A bill-of-materials line as carried by the request. */
export interface RfqItem {
  readonly id: RfqItemId;
  readonly rfqId: RfqId;
  readonly reference: string;
  readonly componentName: string;
  readonly manufacturerPartNumber?: string | undefined;
  readonly sku?: string | undefined;
  readonly quantityRequired: number;
}
