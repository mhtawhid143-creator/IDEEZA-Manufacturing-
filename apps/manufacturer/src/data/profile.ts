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

export interface ShopMachineRow {
  readonly id: string;
  readonly name: string;
  readonly process: string;
  readonly subProcesses: readonly string[];
  readonly tolerance: string | null;
  readonly turnaroundTime: string | null;
}

export interface ShopCapabilitySheetRow {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly parameters: readonly {
    readonly id: string;
    readonly label: string;
    readonly values: readonly string[];
  }[];
}

export interface ShopArticleRow {
  readonly id: string;
  readonly title: string;
  readonly category: string | null;
  readonly tags: readonly string[];
  readonly status: string;
  readonly rejectReason: string | null;
  readonly on: Date;
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
  /** The line under the shop's name, and the introduction below it. */
  readonly tagline: string | null;
  readonly about: string | null;
  /** How a buyer reaches the shop outside the platform. */
  readonly phone: string | null;
  readonly websiteUrl: string | null;
  readonly employeeBand: string | null;
  readonly shippingMethods: readonly string[];
  /** Absent is the common case, and renders as nothing rather than an empty row. */
  readonly facebookUrl: string | null;
  readonly twitterUrl: string | null;
  readonly instagramUrl: string | null;
  readonly linkedinUrl: string | null;
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
  /** What is on the floor, what it can do, and what the shop has written. */
  readonly machines: readonly ShopMachineRow[];
  readonly capabilitySheets: readonly ShopCapabilitySheetRow[];
  readonly articles: readonly ShopArticleRow[];
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
      machines: { orderBy: { position: 'asc' } },
      capabilitySheets: {
        orderBy: { position: 'asc' },
        include: { parameters: { orderBy: { position: 'asc' } } },
      },
      articles: { orderBy: { createdAt: 'desc' } },
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
    tagline: shop.tagline,
    about: shop.about,
    phone: shop.phone,
    websiteUrl: shop.websiteUrl,
    employeeBand: shop.employeeBand,
    shippingMethods: shop.shippingMethods,
    facebookUrl: shop.facebookUrl,
    twitterUrl: shop.twitterUrl,
    instagramUrl: shop.instagramUrl,
    linkedinUrl: shop.linkedinUrl,
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
    machines: shop.machines.map((machine) => ({
      id: machine.id,
      name: machine.name,
      process: machine.process,
      subProcesses: machine.subProcesses,
      tolerance: machine.tolerance,
      turnaroundTime: machine.turnaroundTime,
    })),
    capabilitySheets: shop.capabilitySheets.map((sheet) => ({
      id: sheet.id,
      kind: sheet.kind,
      title: sheet.title,
      parameters: sheet.parameters.map((parameter) => ({
        id: parameter.id,
        label: parameter.label,
        values: parameter.values,
      })),
    })),
    articles: shop.articles.map((article) => ({
      id: article.id,
      title: article.title,
      category: article.category,
      tags: article.tags,
      status: article.status,
      rejectReason: article.rejectReason,
      on: article.publishedAt ?? article.createdAt,
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
  /**
   * Everything below is optional, and absent means "leave it as it is".
   *
   * Two screens call this: the profile, which edits the whole record, and
   * settings, which edits only the name and the address. If the fields were
   * required, saving an address from settings would send empty strings for the
   * shop's own words and quietly wipe them.
   */
  readonly tagline?: string;
  readonly about?: string;
  readonly phone?: string;
  readonly websiteUrl?: string;
  readonly employeeBand?: string;
  /** Carriers, already split by the caller. */
  readonly shippingMethods?: readonly string[];
  readonly facebookUrl?: string;
  readonly twitterUrl?: string;
  readonly instagramUrl?: string;
  readonly linkedinUrl?: string;
}

/** Empty stays empty; anything else has to be a web address a browser can open. */
const asLink = (value: string): { readonly ok: true; readonly url: string | null } | { readonly ok: false } => {
  const trimmed = value.trim();
  if (trimmed === '') return { ok: true, url: null };
  // A buyer typing "example.com" means the same thing as typing the scheme, so
  // the scheme is added rather than the address refused.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.hostname.includes('.')) return { ok: true, url: parsed.toString() };
    return { ok: false };
  } catch {
    return { ok: false };
  }
};

const blankToNull = (value: string): string | null =>
  value.trim() === '' ? null : value.trim();

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

  // A link that does not open is worse than no link: a buyer clicks it once,
  // lands nowhere, and reads that as the shop rather than as the field.
  const linkFields = ['websiteUrl', 'facebookUrl', 'twitterUrl', 'instagramUrl', 'linkedinUrl'] as const;
  const links: Partial<Record<(typeof linkFields)[number], string | null>> = {};
  for (const field of linkFields) {
    const given = edit[field];
    if (given === undefined) continue;
    const parsed = asLink(given);
    if (!parsed.ok) {
      return {
        ok: false,
        message: `That ${field.replace('Url', '')} address is not one a buyer's browser could open.`,
      };
    }
    links[field] = parsed.url;
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
      // Spread rather than assign: a key that is not in the object is a field
      // Prisma leaves alone, which is what "absent means unchanged" needs.
      ...(edit.tagline === undefined ? {} : { tagline: blankToNull(edit.tagline) }),
      ...(edit.about === undefined ? {} : { about: blankToNull(edit.about) }),
      ...(edit.phone === undefined ? {} : { phone: blankToNull(edit.phone) }),
      ...(edit.employeeBand === undefined
        ? {}
        : { employeeBand: blankToNull(edit.employeeBand) }),
      ...(edit.shippingMethods === undefined
        ? {}
        : {
            shippingMethods: edit.shippingMethods
              .map((method) => method.trim())
              .filter((method) => method !== ''),
          }),
      ...links,
    },
  });

  return { ok: true };
};

export interface MachineEdit {
  readonly name: string;
  readonly process: string;
  readonly subProcesses: readonly string[];
  readonly tolerance: string;
  readonly turnaroundTime: string;
}

/**
 * Adds a machine to the shop's floor list.
 *
 * Scoped to the shop the caller acts for, like every other write here: the id
 * comes from the session, never from the form, so a member cannot list a
 * machine against somebody else's shop.
 */
interface MachineFields {
  readonly name: string;
  readonly process: string;
  readonly subProcesses: string[];
  readonly tolerance: string | null;
  readonly turnaroundTime: string | null;
}

/**
 * The same reading for adding one and for editing one.
 *
 * Both writes are the same form, so both must refuse the same things — a
 * machine with no name, or one with no process. A machine without a process is
 * a photograph: a buyer deciding between two shops cannot act on it.
 */
const readMachine = (edit: MachineEdit): MachineFields | string => {
  const name = edit.name.trim();
  const process = edit.process.trim();
  if (name.length < 2) return 'Which machine? Pick one from the list.';
  if (process === '') {
    return 'What does it do? A machine without a process tells a buyer nothing.';
  }
  return {
    name,
    process,
    subProcesses: edit.subProcesses.map((entry) => entry.trim()).filter((entry) => entry !== ''),
    tolerance: blankToNull(edit.tolerance),
    turnaroundTime: blankToNull(edit.turnaroundTime),
  };
};

export const addMachine = async (
  manufacturerId: ManufacturerId,
  edit: MachineEdit,
): Promise<ProfileOutcome> => {
  const fields = readMachine(edit);
  if (typeof fields === 'string') return { ok: false, message: fields };

  const last = await database().shopMachine.findFirst({
    where: { manufacturerId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  await database().shopMachine.create({
    data: {
      id: `machine_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      manufacturerId,
      ...fields,
      position: (last?.position ?? -1) + 1,
    },
  });

  return { ok: true };
};

/**
 * Edits one in place, scoped by shop.
 *
 * `updateMany` rather than `update`: the id alone would find another shop's
 * machine and change it. Scoping the write itself means a wrong id changes
 * nothing and says so, which is the same rule every other write here follows.
 */
export const updateMachine = async (
  manufacturerId: ManufacturerId,
  machineId: string,
  edit: MachineEdit,
): Promise<ProfileOutcome> => {
  const fields = readMachine(edit);
  if (typeof fields === 'string') return { ok: false, message: fields };

  const { count } = await database().shopMachine.updateMany({
    where: { id: machineId, manufacturerId },
    data: fields,
  });

  return count === 0
    ? { ok: false, message: 'That machine is not on your floor list.' }
    : { ok: true };
};

/** Removes one, scoped so a member can only remove their own shop's. */
export const removeMachine = async (
  manufacturerId: ManufacturerId,
  machineId: string,
): Promise<ProfileOutcome> => {
  const { count } = await database().shopMachine.deleteMany({
    where: { id: machineId, manufacturerId },
  });
  return count === 0
    ? { ok: false, message: 'That machine is not on your floor list.' }
    : { ok: true };
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
