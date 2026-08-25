import type {
  IsoTimestamp,
  ManufacturerId,
  ManufacturerMemberId,
  UserId,
} from '../ids.js';

export interface PostalAddress {
  readonly line1: string;
  readonly line2?: string | undefined;
  readonly city: string;
  readonly region?: string | undefined;
  readonly postalCode?: string | undefined;
  readonly countryCode: string;
}

/** A buyer account. The buyer owns products, requests and payments. */
export interface User {
  readonly id: UserId;
  readonly email: string;
  readonly displayName: string;
  readonly addresses: readonly PostalAddress[];
  readonly createdAt: IsoTimestamp;
  readonly suspendedAt?: IsoTimestamp | undefined;
}

/**
 * Manufacturing capability, as surfaced in buyer-side discovery and used by the
 * manufacturer to judge whether it can quote an incoming request at all.
 */
export interface ManufacturerCapability {
  readonly services: readonly string[];
  readonly certifications: readonly string[];
  readonly minimumOrderQuantity: number;
  readonly standardLeadTimeDays: number;
  readonly servedRegions: readonly string[];
}

export interface ManufacturerProfile {
  readonly id: ManufacturerId;
  readonly legalName: string;
  readonly displayName: string;
  readonly location: PostalAddress;
  readonly capability: ManufacturerCapability;
  readonly rating?: number | undefined;
  readonly onTimeDeliveryRate?: number | undefined;
  readonly completedOrderCount: number;
  readonly verifiedAt?: IsoTimestamp | undefined;
  readonly createdAt: IsoTimestamp;
}

/** A person acting on behalf of a manufacturer organisation. */
export interface ManufacturerMember {
  readonly id: ManufacturerMemberId;
  readonly manufacturerId: ManufacturerId;
  readonly userId: UserId;
  readonly isOwner: boolean;
  readonly createdAt: IsoTimestamp;
}
