import { asId, type ManufacturerId, type UserId } from '@ideeza/domain';
import { database } from '@/lib/db.js';

export interface ProfileReview {
  readonly id: string;
  readonly rating: number;
  readonly headline: string | null;
  readonly body: string | null;
  readonly buyerName: string;
  readonly productName: string;
  readonly publishedAt: Date;
}

export interface ShopProfile {
  readonly manufacturerId: ManufacturerId;
  readonly legalName: string;
  readonly displayName: string;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly city: string;
  readonly region: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string;
  readonly rating: number | null;
  readonly onTimeDeliveryRate: number | null;
  readonly completedOrderCount: number;
  readonly verified: boolean;
  readonly memberSince: Date;
  readonly services: readonly string[];
  readonly certifications: readonly string[];
  readonly servedRegions: readonly string[];
  readonly minimumOrderQuantity: number | null;
  readonly standardLeadTimeDays: number | null;
  readonly reviews: readonly ProfileReview[];
  readonly reviewCount: number;
  readonly members: readonly {
    readonly name: string;
    readonly email: string;
    readonly owner: boolean;
  }[];
  /** Live counts, so the header is not a number somebody typed. */
  readonly quoteCount: number;
  readonly orderCount: number;
  readonly partCount: number;
}

/** Everything the profile screens show, from what the platform actually holds. */
export const getShopProfile = async (
  manufacturerId: ManufacturerId,
): Promise<ShopProfile | null> => {
  const shop = await database().manufacturerProfile.findUnique({
    where: { id: manufacturerId },
    include: {
      capability: true,
      members: {
        include: { user: { select: { displayName: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          author: { select: { displayName: true } },
          order: {
            select: {
              rfq: {
                select: { package: { select: { product: { select: { name: true } } } } },
              },
            },
          },
        },
      },
      _count: { select: { reviews: true, quotes: true, orders: true, inventoryItems: true } },
    },
  });
  if (shop === null) return null;

  return {
    manufacturerId: asId<ManufacturerId>(shop.id),
    legalName: shop.legalName,
    displayName: shop.displayName,
    addressLine1: shop.addressLine1,
    addressLine2: shop.addressLine2,
    city: shop.city,
    region: shop.region,
    postalCode: shop.postalCode,
    countryCode: shop.countryCode,
    rating: shop.rating === null ? null : Number(shop.rating),
    onTimeDeliveryRate:
      shop.onTimeDeliveryRate === null ? null : Number(shop.onTimeDeliveryRate),
    completedOrderCount: shop.completedOrderCount,
    verified: shop.verifiedAt !== null,
    memberSince: shop.createdAt,
    services: shop.capability?.services ?? [],
    certifications: shop.capability?.certifications ?? [],
    servedRegions: shop.capability?.servedRegions ?? [],
    minimumOrderQuantity: shop.capability?.minimumOrderQuantity ?? null,
    standardLeadTimeDays: shop.capability?.standardLeadTimeDays ?? null,
    reviewCount: shop._count.reviews,
    quoteCount: shop._count.quotes,
    orderCount: shop._count.orders,
    partCount: shop._count.inventoryItems,
    reviews: shop.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      // A review carries a rating and a body; there is no separate headline, and
      // an anonymous one hides the buyer's name rather than inventing one.
      headline: null,
      body: review.body,
      buyerName: review.anonymous ? 'A buyer' : review.author.displayName,
      productName: review.order.rfq.package.product.name,
      publishedAt: review.createdAt,
    })),
    members: shop.members.map((member) => ({
      name: member.user.displayName,
      email: member.user.email,
      owner: member.isOwner,
    })),
  };
};

export type ProfileOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

export interface CompanyEdit {
  readonly displayName: string;
  readonly legalName: string;
  readonly addressLine1: string;
  readonly addressLine2: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  readonly countryCode: string;
}

/**
 * Edits the company details buyers see.
 *
 * The name and the address are what a buyer decides on and what an order ships
 * to, so they are stored rather than kept in a form: everything else on the
 * profile screens that has nowhere to live yet says so on the screen.
 */
export const saveCompany = async (
  manufacturerId: ManufacturerId,
  edit: CompanyEdit,
): Promise<ProfileOutcome> => {
  if (edit.displayName.trim().length < 2) {
    return { ok: false, message: 'A shop needs a name buyers can recognise.' };
  }
  if (edit.city.trim() === '' || edit.addressLine1.trim() === '') {
    return { ok: false, message: 'An address is what an order ships to; fill it in.' };
  }
  if (!/^[A-Za-z]{2}$/.test(edit.countryCode.trim())) {
    return { ok: false, message: 'The country is a two-letter code, such as BD or DE.' };
  }

  await database().manufacturerProfile.update({
    where: { id: manufacturerId },
    data: {
      displayName: edit.displayName.trim(),
      legalName: edit.legalName.trim() === '' ? edit.displayName.trim() : edit.legalName.trim(),
      addressLine1: edit.addressLine1.trim(),
      addressLine2: edit.addressLine2.trim() === '' ? null : edit.addressLine2.trim(),
      city: edit.city.trim(),
      region: edit.region.trim() === '' ? null : edit.region.trim(),
      postalCode: edit.postalCode.trim() === '' ? null : edit.postalCode.trim(),
      countryCode: edit.countryCode.trim().toUpperCase(),
    },
  });

  return { ok: true };
};

export interface CapabilityEdit {
  readonly services: readonly string[];
  readonly certifications: readonly string[];
  readonly servedRegions: readonly string[];
  readonly minimumOrderQuantity: number;
  readonly standardLeadTimeDays: number;
}

/**
 * Saves what buyers are matched on.
 *
 * This is the one part of the profile with teeth: a request only reaches shops
 * whose published services cover it, and a minimum order quantity above the
 * buyer's volume refuses the shop outright. So it is validated and stored.
 */
export const saveCapability = async (
  manufacturerId: ManufacturerId,
  edit: CapabilityEdit,
): Promise<ProfileOutcome> => {
  if (edit.services.length === 0) {
    return {
      ok: false,
      message: 'Publish at least one service, or no request can reach you.',
    };
  }
  if (!Number.isInteger(edit.minimumOrderQuantity) || edit.minimumOrderQuantity < 1) {
    return { ok: false, message: 'A minimum order quantity is at least one unit.' };
  }
  if (!Number.isInteger(edit.standardLeadTimeDays) || edit.standardLeadTimeDays < 1) {
    return { ok: false, message: 'A standard lead time is at least one day.' };
  }

  await database().manufacturerCapability.upsert({
    where: { manufacturerId },
    update: {
      services: [...edit.services],
      certifications: [...edit.certifications],
      servedRegions: [...edit.servedRegions],
      minimumOrderQuantity: edit.minimumOrderQuantity,
      standardLeadTimeDays: edit.standardLeadTimeDays,
    },
    create: {
      manufacturerId,
      services: [...edit.services],
      certifications: [...edit.certifications],
      servedRegions: [...edit.servedRegions],
      minimumOrderQuantity: edit.minimumOrderQuantity,
      standardLeadTimeDays: edit.standardLeadTimeDays,
    },
  });

  return { ok: true };
};

export const asUser = (value: string): UserId => asId<UserId>(value);
