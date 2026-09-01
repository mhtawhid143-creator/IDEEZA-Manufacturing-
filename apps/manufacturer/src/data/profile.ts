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
  /** Where the order shipped, which is the only country the platform knows. */
  readonly countryCode: string;
  /** What the buyer paid, in minor units, with the currency it was paid in. */
  readonly totalMinor: number;
  readonly currency: string;
  /**
   * Days from the order being placed to it being delivered. Null while an
   * order has been reviewed but not yet marked delivered — the design shows a
   * duration, and inventing one would be worse than saying it is not known.
   */
  readonly durationDays: number | null;
}

/** How many reviews sit at each star, five down to one. */
export interface ReviewBreakdown {
  readonly rating: number;
  readonly count: number;
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
  /** Whether anyone at IDEEZA has read the evidence behind it yet. */
  readonly verification: string;
  readonly attachmentNames: readonly string[];
  readonly parameters: readonly {
    readonly id: string;
    readonly label: string;
    readonly values: readonly string[];
  }[];
}

export interface ShopCertificateRow {
  readonly id: string;
  readonly name: string;
  readonly category: string | null;
  readonly issuingAuthority: string | null;
  /** `pending`, `verified` or `issued_by_ideeza` — IDEEZA's word, not the shop's. */
  readonly status: string;
}

export interface ShopEquipmentRow {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
}

export interface ShopArticleRow {
  readonly id: string;
  readonly title: string;
  /** The opening of the article, for the card. Drawn from the body itself. */
  readonly excerpt: string;
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
  /** Averaged over every review, not only the twenty this page lists. */
  readonly averageRating: number | null;
  readonly reviewBreakdown: readonly ReviewBreakdown[];
  readonly members: readonly {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly owner: boolean;
    /** What they do here, in the shop's words. Null until somebody says. */
    readonly title: string | null;
  }[];
  /** What is on the floor, what it can do, and what the shop has written. */
  readonly machines: readonly ShopMachineRow[];
  readonly capabilitySheets: readonly ShopCapabilitySheetRow[];
  readonly certificates: readonly ShopCertificateRow[];
  readonly equipment: readonly ShopEquipmentRow[];
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
              shipToCountryCode: true,
              createdAt: true,
              deliveredAt: true,
              acceptedQuote: { select: { totalPriceMinor: true, currency: true } },
              rfq: {
                select: { package: { select: { product: { select: { name: true } } } } },
              },
            },
          },
        },
      },
      machines: { orderBy: { position: 'asc' } },
      certificates: { orderBy: { position: 'asc' } },
      equipment: { orderBy: { position: 'asc' } },
      capabilitySheets: {
        orderBy: { position: 'asc' },
        include: { parameters: { orderBy: { position: 'asc' } } },
      },
      articles: { orderBy: { createdAt: 'desc' } },
      _count: { select: { reviews: true, quotes: true, orders: true, inventoryItems: true } },
    },
  });
  if (shop === null) return null;

  // Counted rather than derived from the twenty rows above: a shop with three
  // hundred reviews would otherwise show an average of its most recent page.
  const byRating = await database().review.groupBy({
    by: ['rating'],
    where: { manufacturerId },
    _count: { _all: true },
  });
  const breakdown = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: byRating.find((row) => row.rating === rating)?._count._all ?? 0,
  }));
  const totalReviews = breakdown.reduce((sum, row) => sum + row.count, 0);
  const averageRating =
    totalReviews === 0
      ? null
      : breakdown.reduce((sum, row) => sum + row.rating * row.count, 0) / totalReviews;

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
      countryCode: review.order.shipToCountryCode,
      totalMinor: Number(review.order.acceptedQuote.totalPriceMinor),
      currency: review.order.acceptedQuote.currency,
      durationDays:
        review.order.deliveredAt === null
          ? null
          : Math.max(
              1,
              Math.round(
                (review.order.deliveredAt.getTime() - review.order.createdAt.getTime()) /
                  86_400_000,
              ),
            ),
    })),
    averageRating,
    reviewBreakdown: breakdown,
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
      verification: sheet.verification,
      attachmentNames: sheet.attachmentNames,
      parameters: sheet.parameters.map((parameter) => ({
        id: parameter.id,
        label: parameter.label,
        values: parameter.values,
      })),
    })),
    certificates: shop.certificates.map((certificate) => ({
      id: certificate.id,
      name: certificate.name,
      category: certificate.category,
      issuingAuthority: certificate.issuingAuthority,
      status: certificate.status,
    })),
    equipment: shop.equipment.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
    })),
    articles: shop.articles.map((article) => ({
      id: article.id,
      title: article.title,
      // The card shows the opening rather than a second field nobody fills in:
      // an excerpt kept apart from the body drifts from it the first time the
      // article is edited.
      excerpt:
        article.body.length > 180 ? `${article.body.slice(0, 177).trimEnd()}…` : article.body,
      category: article.category,
      tags: article.tags,
      status: article.status,
      rejectReason: article.rejectReason,
      on: article.publishedAt ?? article.createdAt,
    })),
    members: shop.members.map((member) => ({
      id: member.id,
      name: member.user.displayName,
      email: member.user.email,
      owner: member.isOwner,
      title: member.title,
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

export interface CapabilitySheetEdit {
  readonly kind: string;
  readonly title: string;
  /** Label and values per row, in the order the card will list them. */
  readonly parameters: readonly { readonly label: string; readonly values: readonly string[] }[];
  readonly attachmentNames: readonly string[];
}

const cleanSheet = (
  edit: CapabilitySheetEdit,
): { readonly title: string; readonly rows: readonly { label: string; values: string[] }[] } | string => {
  const title = edit.title.trim();
  if (title === '') return 'Which kind of work is this sheet for?';

  const rows = edit.parameters
    .map((row) => ({
      label: row.label.trim(),
      values: row.values.map((value) => value.trim()).filter((value) => value !== ''),
    }))
    // A row with nothing in it is left out rather than published as an empty
    // line: the card would show a label and a blank, which reads as a gap in
    // the shop's answer rather than a question it chose not to answer.
    .filter((row) => row.label !== '' && row.values.length > 0);

  if (rows.length === 0) return 'A sheet with no answers tells a buyer nothing. Fill in at least one.';
  return { title, rows };
};

/**
 * Writes a sheet and its rows in one transaction.
 *
 * The rows are replaced rather than merged: the form sends the whole sheet, so
 * a row the shop cleared has to disappear, and a diff would leave the one it
 * forgot to mention behind.
 */
const writeSheet = async (
  sheetId: string,
  manufacturerId: ManufacturerId,
  kind: string,
  title: string,
  rows: readonly { label: string; values: string[] }[],
  attachmentNames: readonly string[],
  position: number,
): Promise<void> => {
  const names = attachmentNames.map((name) => name.trim()).filter((name) => name !== '');
  await database().$transaction(async (tx) => {
    await tx.shopCapabilitySheet.upsert({
      where: { id: sheetId },
      update: { title, attachmentNames: names },
      create: {
        id: sheetId,
        manufacturerId,
        kind: kind as never,
        title,
        attachmentNames: names,
        position,
      },
    });
    await tx.shopCapabilityParameter.deleteMany({ where: { sheetId } });
    await tx.shopCapabilityParameter.createMany({
      data: rows.map((row, index) => ({
        id: `${sheetId}_p${String(index)}`,
        sheetId,
        label: row.label,
        values: row.values,
        position: index,
      })),
    });
  });
};

/**
 * Adds a sheet for a kind of work this shop has not published one for.
 *
 * One sheet per kind is a database constraint, and the refusal says so rather
 * than letting the constraint surface as an error: a shop with two PCB sheets
 * would show a buyer two different answers to the same question.
 */
export const addCapabilitySheet = async (
  manufacturerId: ManufacturerId,
  edit: CapabilitySheetEdit,
): Promise<ProfileOutcome> => {
  const clean = cleanSheet(edit);
  if (typeof clean === 'string') return { ok: false, message: clean };

  const already = await database().shopCapabilitySheet.findFirst({
    where: { manufacturerId, kind: edit.kind as never },
    select: { id: true },
  });
  if (already !== null) {
    return {
      ok: false,
      message: `You already publish a ${clean.title} sheet. Edit that one instead.`,
    };
  }

  const last = await database().shopCapabilitySheet.findFirst({
    where: { manufacturerId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  await writeSheet(
    `sheet_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    manufacturerId,
    edit.kind,
    clean.title,
    clean.rows,
    edit.attachmentNames,
    (last?.position ?? -1) + 1,
  );

  return { ok: true };
};

/**
 * Rewrites one, scoped by shop.
 *
 * Editing a sheet takes it back to pending: the answers IDEEZA read are not
 * the answers on the card any more, and leaving the Verified chip on would
 * make the platform vouch for something nobody checked.
 */
export const updateCapabilitySheet = async (
  manufacturerId: ManufacturerId,
  sheetId: string,
  edit: CapabilitySheetEdit,
): Promise<ProfileOutcome> => {
  const clean = cleanSheet(edit);
  if (typeof clean === 'string') return { ok: false, message: clean };

  const mine = await database().shopCapabilitySheet.findFirst({
    where: { id: sheetId, manufacturerId },
    select: { id: true, kind: true, position: true },
  });
  if (mine === null) return { ok: false, message: 'That sheet is not one of yours.' };

  await writeSheet(
    mine.id,
    manufacturerId,
    mine.kind,
    clean.title,
    clean.rows,
    edit.attachmentNames,
    mine.position,
  );
  await database().shopCapabilitySheet.update({
    where: { id: mine.id },
    data: { verification: 'pending' },
  });

  return { ok: true };
};

/** Takes one down, scoped so a member can only remove their own shop's. */
export const removeCapabilitySheet = async (
  manufacturerId: ManufacturerId,
  sheetId: string,
): Promise<ProfileOutcome> => {
  const { count } = await database().shopCapabilitySheet.deleteMany({
    where: { id: sheetId, manufacturerId },
  });
  return count === 0
    ? { ok: false, message: 'That sheet is not one of yours.' }
    : { ok: true };
};

/**
 * Says what a member does here.
 *
 * A role, not a permission — what a member may do is decided by `isOwner` and
 * the route rules, and nothing reads this. It is on the profile because a
 * buyer choosing a shop reads who is in it.
 */
export const setMemberTitle = async (
  manufacturerId: ManufacturerId,
  memberId: string,
  title: string,
): Promise<ProfileOutcome> => {
  const { count } = await database().manufacturerMember.updateMany({
    where: { id: memberId, manufacturerId },
    data: { title: blankToNull(title) },
  });
  return count === 0
    ? { ok: false, message: 'That person is not in your shop.' }
    : { ok: true };
};

export interface CertificateEdit {
  readonly name: string;
  readonly category: string;
  readonly issuingAuthority: string;
}

/**
 * Keeps the flat list on the capability record in step with the rows.
 *
 * Two places hold the certificate names — the rows the tab draws, and the
 * array the completeness check reads. They are written together so the second
 * can never say a shop holds something the first has never heard of.
 */
const syncCertificationNames = async (manufacturerId: ManufacturerId): Promise<void> => {
  const rows = await database().shopCertification.findMany({
    where: { manufacturerId },
    orderBy: { position: 'asc' },
    select: { name: true },
  });
  const names = [...new Set(rows.map((row) => row.name))];
  await database().manufacturerCapability.updateMany({
    where: { manufacturerId },
    data: { certifications: names },
  });
};

/** Adds a certificate the shop claims. IDEEZA decides whether it is verified. */
export const addCertificate = async (
  manufacturerId: ManufacturerId,
  edit: CertificateEdit,
): Promise<ProfileOutcome> => {
  const name = edit.name.trim();
  if (name.length < 2) {
    return { ok: false, message: 'Which certificate? Pick one from the list.' };
  }

  const already = await database().shopCertification.findFirst({
    where: { manufacturerId, name },
    select: { id: true },
  });
  if (already !== null) {
    return { ok: false, message: `${name} is already on your profile.` };
  }

  const last = await database().shopCertification.findFirst({
    where: { manufacturerId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  await database().shopCertification.create({
    data: {
      id: `cert_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      manufacturerId,
      name,
      category: blankToNull(edit.category),
      issuingAuthority: blankToNull(edit.issuingAuthority),
      position: (last?.position ?? -1) + 1,
    },
  });
  await syncCertificationNames(manufacturerId);

  return { ok: true };
};

/** Takes one off, scoped by shop. */
export const removeCertificate = async (
  manufacturerId: ManufacturerId,
  certificateId: string,
): Promise<ProfileOutcome> => {
  const { count } = await database().shopCertification.deleteMany({
    where: { id: certificateId, manufacturerId },
  });
  if (count === 0) return { ok: false, message: 'That certificate is not one of yours.' };
  await syncCertificationNames(manufacturerId);
  return { ok: true };
};

export interface EquipmentEdit {
  readonly name: string;
  readonly quantity: number;
}

/** Adds a line to the equipment count the profile shows. */
export const addEquipment = async (
  manufacturerId: ManufacturerId,
  edit: EquipmentEdit,
): Promise<ProfileOutcome> => {
  const name = edit.name.trim();
  if (name.length < 2) {
    return { ok: false, message: 'What is it? A buyer has to recognise the name.' };
  }
  if (!Number.isInteger(edit.quantity) || edit.quantity < 1 || edit.quantity > 999) {
    return { ok: false, message: 'How many? A whole number, at least one.' };
  }

  const last = await database().shopEquipment.findFirst({
    where: { manufacturerId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  await database().shopEquipment.create({
    data: {
      id: `equip_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      manufacturerId,
      name,
      quantity: edit.quantity,
      position: (last?.position ?? -1) + 1,
    },
  });

  return { ok: true };
};

/** Takes one off, scoped by shop. */
export const removeEquipment = async (
  manufacturerId: ManufacturerId,
  equipmentId: string,
): Promise<ProfileOutcome> => {
  const { count } = await database().shopEquipment.deleteMany({
    where: { id: equipmentId, manufacturerId },
  });
  return count === 0
    ? { ok: false, message: 'That is not on your equipment list.' }
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
