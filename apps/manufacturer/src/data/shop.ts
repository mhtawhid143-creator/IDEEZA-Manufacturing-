import { asId, type ManufacturerId, type UserId } from '@ideeza/domain';
import { database } from '@/lib/db.js';

export interface ShopContext {
  readonly manufacturerId: ManufacturerId;
  readonly displayName: string;
  readonly legalName: string;
  readonly city: string;
  readonly countryCode: string;
  readonly verified: boolean;
  readonly rating: number | null;
  readonly completedOrderCount: number;
  readonly onTimeDeliveryRate: number | null;
  readonly services: readonly string[];
  readonly certifications: readonly string[];
  readonly servedRegions: readonly string[];
  readonly minimumOrderQuantity: number | null;
  readonly standardLeadTimeDays: number | null;
  /** How much of what a buyer is matched against has been filled in. */
  readonly profileCompleteness: number;
  readonly unreadNotifications: number;
}

/**
 * The shop the signed-in member is acting for.
 *
 * Everything the panel shows hangs off this: it is read once per request in the
 * shell and passed down, so no screen has to re-establish whose data it is
 * looking at.
 *
 * Completeness is not decoration. A buyer's manufacturer list is filtered and
 * ranked on capabilities, regions, minimum order quantity and lead time, so a
 * shop that has not filled them in is invisible to the buyers it wants — and the
 * rail says so with the same number.
 */
export const getShopContext = async (
  manufacturerId: ManufacturerId,
  userId: UserId,
): Promise<ShopContext | null> => {
  const [profile, unread] = await Promise.all([
    database().manufacturerProfile.findUnique({
      where: { id: manufacturerId },
      include: { capability: true },
    }),
    database().notification.count({ where: { recipientId: userId, readAt: null } }),
  ]);
  if (profile === null) return null;

  const capability = profile.capability;

  const filled = [
    profile.addressLine1 !== '',
    profile.city !== '',
    profile.countryCode !== '',
    profile.verifiedAt !== null,
    (capability?.services.length ?? 0) > 0,
    (capability?.servedRegions.length ?? 0) > 0,
    (capability?.certifications.length ?? 0) > 0,
    (capability?.minimumOrderQuantity ?? 0) > 0,
    (capability?.standardLeadTimeDays ?? 0) > 0,
  ];
  const profileCompleteness = Math.round(
    (filled.filter(Boolean).length / filled.length) * 100,
  );

  return {
    manufacturerId: asId<ManufacturerId>(profile.id),
    displayName: profile.displayName,
    legalName: profile.legalName,
    city: profile.city,
    countryCode: profile.countryCode,
    verified: profile.verifiedAt !== null,
    rating: profile.rating === null ? null : Number(profile.rating),
    completedOrderCount: profile.completedOrderCount,
    onTimeDeliveryRate:
      profile.onTimeDeliveryRate === null ? null : Number(profile.onTimeDeliveryRate),
    services: capability?.services ?? [],
    certifications: capability?.certifications ?? [],
    servedRegions: capability?.servedRegions ?? [],
    minimumOrderQuantity: capability?.minimumOrderQuantity ?? null,
    standardLeadTimeDays: capability?.standardLeadTimeDays ?? null,
    profileCompleteness,
    unreadNotifications: unread,
  };
};
