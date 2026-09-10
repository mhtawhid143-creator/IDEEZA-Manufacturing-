import {
  EMPTY_BOARD_SPECIFICATION,
  PACKAGE_KIND_LABEL,
  packageKindsIncluding,
  quoteCostKindsFor,
  quoteLifecycle,
  reviewSectionsFor,
  quoteReason,
  requestLifecycle,
  type QuoteCostKind,
  type QuoteLifecycle,
  type ProductionFileWork,
  type QuoteReason,
  type ReviewRecord,
  type ReviewSection,
  type RequestLifecycle,
  asId,
  declineReasonLabel,
  explainTransition,
  assertManufacturerMayReadRfq,
  boardSpecificationRows,
  printSpecificationRows,
  fileKindOf,
  requirementRows,
  rfqRecipientMachine,
  serviceLabels,
  type DocumentRow,
  type ManufacturerId,
  type PackageKind,
  type RfqDeclineReason,
  type RfqId,
  type RfqRecipientStatus,
  type UserId,
} from '@ideeza/domain';
import { toDatabaseEventKind } from '@ideeza/db';
import { database } from '@/lib/db.js';

/** Prisma hands back a Decimal; the document reads plain numbers. */
const decimal = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface RequestRow {
  readonly rfqId: RfqId;
  readonly productName: string;
  readonly description: string;
  readonly kind: PackageKind;
  readonly kindLabel: string;
  readonly quantity: number;
  readonly status: RfqRecipientStatus;
  /**
   * The one of six the row is in (UIUX-127), which is what the pill shows.
   *
   * The routing status is kept beside it because the row menu still needs to
   * know what this shop did, which is a different question from where the
   * request ended up.
   */
  readonly lifecycle: RequestLifecycle;
  readonly receivedAt: Date;
  /** When this shop first opened it, which is a fact about the clock. */
  readonly openedAt: Date | null;
  readonly respondBy: Date | null;
  readonly neededBy: Date | null;
  readonly buyerName: string;
  readonly quoted: boolean;
  readonly quoteId: string | null;
  readonly fileCount: number;
  readonly bomLineCount: number;
}

export interface InboxCounters {
  readonly total: number;
  /**
   * One count per lifecycle value (UIUX-127), and they add up to `total`.
   *
   * Kept as a record rather than six fields so the panel and the filter can
   * both walk the six in order without either of them naming them again.
   */
  readonly byLifecycle: Readonly<Record<RequestLifecycle, number>>;
  readonly awaiting: number;
  readonly quoted: number;
  readonly accepted: number;
  readonly withdrawn: number;
  readonly declined: number;
  readonly expired: number;
  /**
   * Unanswered requests whose reply-by date has passed (UIUX-125).
   *
   * A count of what is waiting says nothing about whether any of it is late,
   * and a shop reading "12 waiting" cannot tell a quiet morning from a missed
   * deadline. This is the part of that number with a clock on it.
   */
  readonly overdue: number;
}

export interface InboxFilters {
  /** One of the six the inbox is partitioned into (UIUX-127), or all of them. */
  readonly status?: RequestLifecycle | 'all';
  readonly kind?: PackageKind | 'all';
  readonly search?: string;
  /** 1-based, because that is what the pager in the design shows. */
  readonly page?: number;
  readonly pageSize?: number;
}

export interface InboxPage {
  readonly rows: readonly RequestRow[];
  /** Matching the filters, not the page: the pager needs the whole count. */
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

const recipientInclude = {
  rfq: {
    select: {
      id: true,
      quantity: true,
      status: true,
      neededBy: true,
      responseDeadline: true,
      submittedAt: true,
      requestedServices: true,
      buyer: { select: { displayName: true } },
      package: {
        select: {
          kind: true,
          product: { select: { name: true } },
          _count: { select: { files: true, bomLines: true } },
        },
      },
      requirements: { select: { manufacturingMethod: true } },
      items: { select: { id: true } },
    },
  },
} as const;

/**
 * The requests routed to this shop.
 *
 * A manufacturer's inbox is its routing records, not the request table: a request
 * exists for every shop it was sent to, and this shop may only ever see its own
 * row. That is why the query starts at `RfqRecipient` and never at `Rfq`.
 */
/**
 * The filter clause for one lifecycle value (UIUX-127).
 *
 * It has to say in SQL exactly what `requestLifecycle` says in TypeScript,
 * including the precedence — a request this shop won is "accepted" and not
 * "quoted", and one the buyer pulled after this shop declined stays
 * "declined". Anything looser and the filter would return rows whose own pill
 * contradicted the filter they arrived under.
 */
const lifecycleWhere = (
  manufacturerId: ManufacturerId,
  lifecycle: RequestLifecycle,
): Record<string, unknown> => {
  const mineAccepted = {
    quotes: { some: { manufacturerId, status: 'accepted' as const } },
  };
  switch (lifecycle) {
    case 'accepted':
      return { rfq: mineAccepted };
    case 'declined':
      return { status: 'declined' as const };
    case 'expired':
      return { status: 'expired' as const };
    // Each of the three open cases restates the draft exclusion, because this
    // clause replaces the base one and a request nobody sent must never appear.
    case 'withdrawn':
      return {
        status: { in: ['routed', 'viewed', 'quoted'] as const },
        rfq: { status: 'withdrawn' as const, NOT: mineAccepted },
      };
    case 'quoted':
      return {
        status: 'quoted' as const,
        rfq: {
          status: { notIn: ['draft', 'withdrawn'] as const },
          NOT: mineAccepted,
        },
      };
    default:
      return {
        status: { in: ['routed', 'viewed'] as const },
        rfq: {
          status: { notIn: ['draft', 'withdrawn'] as const },
          NOT: mineAccepted,
        },
      };
  }
};

export const listRoutedRequests = async (
  manufacturerId: ManufacturerId,
  filters: InboxFilters = {},
): Promise<InboxPage> => {
  const search = filters.search?.trim() ?? '';
  const pageSize = filters.pageSize ?? 10;

  const chosen =
    filters.status === undefined || filters.status === 'all'
      ? {}
      : lifecycleWhere(manufacturerId, filters.status);

  const where = {
    manufacturerId,
    ...chosen,
    rfq: {
      // A draft is the buyer's private workspace: it was never sent.
      status: { not: 'draft' as const },
      // Whatever the chosen lifecycle says about the request itself, kept
      // beside the draft rule rather than replacing it.
      ...((chosen['rfq'] as Record<string, unknown> | undefined) ?? {}),
      // One `package` filter, so a search and a work-type filter narrow together
      // instead of the second one replacing the first.
      package: {
        // "PCB" means the request has boards in it, combined packages
        // included (UIUX-126). An exact match hid every combined request from
        // both of the filters a shop would have used to find it.
        ...(filters.kind === undefined || filters.kind === 'all'
          ? {}
          : { kind: { in: [...packageKindsIncluding(filters.kind)] } }),
        ...(search === ''
          ? {}
          : { product: { name: { contains: search, mode: 'insensitive' as const } } }),
      },
    },
  };

  const total = await database().rfqRecipient.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);

  const rows = await database().rfqRecipient.findMany({
    where,
    include: recipientInclude,
    orderBy: [{ createdAt: 'desc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const quotes = await database().quote.findMany({
    where: {
      manufacturerId,
      rfqId: { in: rows.map((row) => row.rfqId) },
      status: { not: 'draft' },
    },
    select: { id: true, rfqId: true, status: true },
  });

  const mapped = rows.map((row) => {
    const mine = quotes.filter((candidate) => candidate.rfqId === row.rfqId);
    // The newest quote is the one the row links to; every version's status
    // counts towards where the request got to.
    const quote = mine[0];
    return {
      rfqId: asId<RfqId>(row.rfqId),
      productName: row.rfq.package.product.name,
      description: row.rfq.requirements.manufacturingMethod,
      kind: row.rfq.package.kind,
      kindLabel: PACKAGE_KIND_LABEL[row.rfq.package.kind],
      quantity: row.rfq.quantity,
      status: row.status,
      lifecycle: requestLifecycle({
        routing: row.status,
        requestWithdrawn: row.rfq.status === 'withdrawn',
        myQuoteStatuses: mine.map((candidate) => candidate.status),
      }),
      receivedAt: row.rfq.submittedAt ?? row.createdAt,
      openedAt: row.viewedAt,
      respondBy: row.rfq.responseDeadline,
      neededBy: row.rfq.neededBy,
      buyerName: row.rfq.buyer.displayName,
      quoted: quote !== undefined,
      quoteId: quote?.id ?? null,
      fileCount: row.rfq.package._count.files,
      bomLineCount: row.rfq.items.length,
    };
  });

  return { rows: mapped, total, page, pageCount };
};

export const inboxCounters = async (
  manufacturerId: ManufacturerId,
): Promise<InboxCounters> => {
  const [routings, overdue, wonRfqIds, withdrawnRfqIds] = await Promise.all([
    // Every routing row, so the six below are a partition of the same set the
    // total is taken from and can be checked against it.
    database().rfqRecipient.findMany({
      where: { manufacturerId, rfq: { status: { not: 'draft' } } },
      select: { rfqId: true, status: true },
    }),
    // Unanswered, and the buyer's own reply-by date has gone. Counted here
    // rather than filtered from the rows, because it is a judgement about the
    // clock and the pager only holds one page.
    database().rfqRecipient.count({
      where: {
        manufacturerId,
        status: { in: ['routed', 'viewed'] },
        rfq: {
          status: { not: 'draft' },
          responseDeadline: { not: null, lt: new Date() },
        },
      },
    }),
    // Requests this shop won, and requests the buyer pulled — the two facts the
    // routing row cannot carry.
    database().quote.findMany({
      where: { manufacturerId, status: 'accepted' },
      select: { rfqId: true },
    }),
    database().rfq.findMany({
      where: { status: 'withdrawn', recipients: { some: { manufacturerId } } },
      select: { id: true },
    }),
  ]);

  const won = new Set(wonRfqIds.map((quote) => quote.rfqId));
  const pulled = new Set(withdrawnRfqIds.map((rfq) => rfq.id));

  // Derived through the same function the rows use, so a row's pill and the
  // count above it cannot disagree about where a request got to.
  const byLifecycle: Record<RequestLifecycle, number> = {
    new: 0,
    quoted: 0,
    accepted: 0,
    declined: 0,
    expired: 0,
    withdrawn: 0,
  };
  for (const routing of routings) {
    byLifecycle[
      requestLifecycle({
        routing: routing.status,
        requestWithdrawn: pulled.has(routing.rfqId),
        myQuoteStatuses: won.has(routing.rfqId) ? ['accepted'] : [],
      })
    ] += 1;
  }

  return {
    total: routings.length,
    byLifecycle,
    awaiting: byLifecycle.new,
    quoted: byLifecycle.quoted,
    accepted: byLifecycle.accepted,
    withdrawn: byLifecycle.withdrawn,
    declined: byLifecycle.declined,
    expired: byLifecycle.expired,
    overdue,
  };
};

export interface RequestFile {
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly byteSize: number;
  readonly kind: 'pcb' | 'model_3d' | 'document';
  readonly contentHash: string;
}

export interface RequestBomLine {
  readonly id: string;
  readonly reference: string;
  readonly componentName: string;
  readonly manufacturerPartNumber: string | null;
  readonly sku: string | null;
  readonly quantityRequired: number;
}

export interface RequestDetail {
  readonly rfqId: RfqId;
  readonly status: RfqRecipientStatus;
  readonly rfqStatus: string;
  readonly open: boolean;
  readonly productName: string;
  /** The project this was designed as, which every later record descends from. */
  readonly projectId: string;
  readonly creatorName: string;
  readonly buyerId: UserId;
  readonly buyerName: string;
  readonly kind: PackageKind;
  readonly kindLabel: string;
  readonly quantity: number;
  readonly volumeTiers: readonly number[];
  readonly currency: string;
  readonly targetPriceMinor: number | null;
  readonly requestedServices: readonly string[];
  readonly serviceLabels: readonly string[];
  readonly receivedAt: Date;
  readonly respondBy: Date | null;
  readonly neededBy: Date | null
  readonly expiresAt: Date | null;
  readonly shipTo: {
    readonly line1: string;
    readonly line2: string | null;
    readonly city: string;
    readonly region: string | null;
    readonly postalCode: string | null;
    readonly countryCode: string;
  };
  readonly files: readonly RequestFile[];
  readonly bomLines: readonly RequestBomLine[];
  /** The frozen requirements, read exactly as the buyer's screens read them. */
  readonly requirementRows: readonly DocumentRow[];
  readonly boardSpecRows: readonly DocumentRow[];
  readonly printSpecRows: readonly DocumentRow[];
  readonly hasBoard: boolean;
  readonly hasPrintedPart: boolean;
  /** The cost lines a quote for this request can be built from (UIUX-166). */
  readonly costKinds: readonly QuoteCostKind[];
  /**
   * The shape of the work, for the rules that depend on it (UIUX-147, UIUX-148,
   * UIUX-156): which files the request ought to carry, and whether a bill of
   * materials is a manufacturing input at all.
   *
   * `panelised` is read from the board specification when it says so; a request
   * whose specification is silent is not panelised, which is the safe reading —
   * asking for a panel drawing nobody promised would be a false gap.
   */
  readonly work: ProductionFileWork;
  /**
   * What this shop has to have read before it can price the work, and what it
   * has read so far (UIUX-193).
   */
  readonly reviewRequired: readonly ReviewSection[];
  readonly reviewSeen: ReviewRecord;
  readonly requirementsLockedAt: Date | null;
  readonly notes: string | null;
  readonly myQuote: {
    readonly id: string;
    readonly status: string;
    readonly submittedAt: Date | null;
    readonly unitPriceMinor: number;
    readonly totalPriceMinor: number;
    readonly leadTimeDays: number;
    readonly expiresAt: Date;
    /** Which of the five it reads as, and why it wants attention (UIUX-176). */
    readonly lifecycle: QuoteLifecycle;
    readonly reason: QuoteReason | null;
    /** Whether it can still be revised or taken off the table. */
    readonly changeable: boolean;
  } | null;
  /** Substitute suggestions prepared but not sent, on this shop's draft quote. */
  readonly draftSuggestionCount: number;
  readonly declineReason: RfqDeclineReason | null;
  /** The stored reason in the words the buyer will read it in. */
  readonly declineReasonLabel: string | null;
  readonly declineNote: string | null;
}

/**
 * One request, in full, for the shop it was routed to.
 *
 * The access rule is the domain's, not a `where` clause: the recipient row is
 * fetched and handed to `assertManufacturerMayReadRfq`, so a request that was
 * never routed here refuses in the same words everywhere.
 */
export const getRoutedRequest = async (
  manufacturerId: ManufacturerId,
  rfqId: RfqId,
): Promise<RequestDetail | null> => {
  const recipient = await database().rfqRecipient.findFirst({
    where: { rfqId, manufacturerId },
    include: {
      rfq: {
        include: {
          buyer: { select: { id: true, displayName: true } },
          items: { orderBy: { reference: 'asc' } },
          requirements: { include: { boardSpec: true, printSpec: true } },
          package: {
            include: {
              product: {
                select: { id: true, name: true, owner: { select: { displayName: true } } },
              },
              files: { include: { file: true } },
            },
          },
        },
      },
    },
  });
  if (recipient === null) return null;

  // The same rule the rest of the platform uses, applied to what was read.
  assertManufacturerMayReadRfq({
    recipients: [
      {
        rfqId: asId<RfqId>(recipient.rfqId),
        manufacturerId: asId<ManufacturerId>(recipient.manufacturerId),
      },
    ],
    manufacturerId,
    rfqId,
  });

  const rfq = recipient.rfq;
  const requirements = rfq.requirements;
  const files: readonly RequestFile[] = rfq.package.files.map((link) => ({
    id: link.file.id,
    name: link.file.name,
    revision: link.file.revision,
    byteSize: link.file.byteSize,
    kind: fileKindOf(link.file.name),
    contentHash: link.file.contentHash,
  }));

  // What the buyer wrote is never hidden. The kind of work normally follows the
  // files — that is the platform's rule for composing a package — but if a
  // specification was filled in, it binds whatever is quoted against it, so its
  // rows are shown even when the file that should carry it is missing.
  const hasBoard =
    files.some((file) => file.kind === 'pcb') || requirements.boardSpec !== null;
  const hasPrintedPart =
    files.some((file) => file.kind === 'model_3d') ||
    requirements.printTechnology !== null ||
    requirements.printMaterial !== null ||
    requirements.infillPercent !== null;

  // A draft quote is this shop's private workspace — where its substitute
  // suggestions live before the quote is sent — so it is not "my quote" yet. The
  // two are kept apart deliberately: one is an offer, the other is a notebook.
  const myQuote = await database().quote.findFirst({
    where: { rfqId, manufacturerId, status: { not: 'draft' } },
    orderBy: { version: 'desc' },
  });
  const draftQuote = await database().quote.findFirst({
    where: { rfqId, manufacturerId, status: 'draft' },
    select: { id: true, _count: { select: { substitutions: true } } },
  });

  return {
    rfqId: asId<RfqId>(rfq.id),
    status: recipient.status,
    rfqStatus: rfq.status,
    open: rfq.status === 'submitted',
    productName: rfq.package.product.name,
    projectId: rfq.package.product.id,
    creatorName: rfq.package.product.owner.displayName,
    buyerId: asId<UserId>(rfq.buyerId),
    buyerName: rfq.buyer.displayName,
    kind: rfq.package.kind,
    kindLabel: PACKAGE_KIND_LABEL[rfq.package.kind],
    quantity: rfq.quantity,
    volumeTiers: rfq.volumeTiers,
    currency: rfq.currency,
    targetPriceMinor:
      rfq.targetPriceMinor === null ? null : Number(rfq.targetPriceMinor),
    requestedServices: rfq.requestedServices,
    serviceLabels: serviceLabels(rfq.requestedServices),
    receivedAt: rfq.submittedAt ?? recipient.createdAt,
    respondBy: rfq.responseDeadline,
    neededBy: rfq.neededBy,
    expiresAt: recipient.expiresAt,
    shipTo: {
      line1: rfq.shipToLine1,
      line2: rfq.shipToLine2,
      city: rfq.shipToCity,
      region: rfq.shipToRegion,
      postalCode: rfq.shipToPostalCode,
      countryCode: rfq.shipToCountryCode,
    },
    files,
    bomLines: rfq.items.map((item) => ({
      id: item.id,
      reference: item.reference,
      componentName: item.componentName,
      manufacturerPartNumber: item.manufacturerPartNumber,
      sku: item.sku,
      quantityRequired: item.quantityRequired,
    })),
    requirementRows: requirementRows({
      quantity: requirements.quantity,
      material: requirements.material,
      manufacturingMethod: requirements.manufacturingMethod,
      tolerance: requirements.tolerance,
      leadTimeDays: requirements.leadTimeDays,
      shippingRequirement: requirements.shippingRequirement,
      assembly: requirements.assembly,
      assemblySides: requirements.assemblySides,
      qualityCheckRequirement: requirements.qualityCheckRequirement,
      substitutionPolicy: requirements.substitutionPolicy,
      notes: requirements.notes,
      printTechnology: requirements.printTechnology,
      printMaterial: requirements.printMaterial,
      printColor: requirements.printColor,
      surfaceFinish: requirements.surfaceFinish,
      infillPercent: requirements.infillPercent,
    }),
    // The printed part's own document, the peer of the board's (UIUX-153).
    printSpecRows: !hasPrintedPart
      ? []
      : printSpecificationRows({
          technology: requirements.printTechnology,
          material: requirements.printMaterial,
          color: requirements.printColor,
          surfaceFinish: requirements.surfaceFinish,
          infillPercent: requirements.infillPercent,
          layerHeightMm: decimal(requirements.printSpec?.layerHeightMm),
          infillPattern: requirements.printSpec?.infillPattern ?? null,
          wallThicknessMm: decimal(requirements.printSpec?.wallThicknessMm),
          dimensionXMm: decimal(requirements.printSpec?.dimensionXMm),
          dimensionYMm: decimal(requirements.printSpec?.dimensionYMm),
          dimensionZMm: decimal(requirements.printSpec?.dimensionZMm),
          toleranceMm: decimal(requirements.printSpec?.toleranceMm),
          supportStructure: requirements.printSpec?.supportStructure ?? null,
          orientationRequirement: requirements.printSpec?.orientationRequirement ?? null,
          durometer: requirements.printSpec?.durometer ?? null,
          postProcessing: requirements.printSpec?.postProcessing ?? null,
          certification: requirements.printSpec?.certification ?? null,
        }),
    boardSpecRows: !hasBoard
      ? []
      : boardSpecificationRows(
          requirements.boardSpec === null
            ? EMPTY_BOARD_SPECIFICATION
            : {
                baseMaterial: requirements.boardSpec.baseMaterial,
                layerCount: requirements.boardSpec.layerCount,
                thicknessMm: decimal(requirements.boardSpec.thicknessMm),
                boardColor: requirements.boardSpec.boardColor,
                silkscreenColor: requirements.boardSpec.silkscreenColor,
                surfaceFinish: requirements.boardSpec.surfaceFinish,
                outerCopperOz: decimal(requirements.boardSpec.outerCopperOz),
                innerCopperOz: decimal(requirements.boardSpec.innerCopperOz),
                viaCovering: requirements.boardSpec.viaCovering,
                minViaHoleMm: decimal(requirements.boardSpec.minViaHoleMm),
                outlineToleranceMm: decimal(requirements.boardSpec.outlineToleranceMm),
                deliveryFormat: requirements.boardSpec.deliveryFormat,
                distinctDesigns: requirements.boardSpec.distinctDesigns,
                electricalTest: requirements.boardSpec.electricalTest,
                goldFingers: requirements.boardSpec.goldFingers,
                castellatedHoles: requirements.boardSpec.castellatedHoles,
                edgePlating: requirements.boardSpec.edgePlating,
                blindOrBuriedVias: requirements.boardSpec.blindOrBuriedVias,
                ulMarking: requirements.boardSpec.ulMarking,
                markOnBoard: requirements.boardSpec.markOnBoard,
                workmanshipClass: requirements.boardSpec.workmanshipClass,
                packaging: requirements.boardSpec.packaging,
                assembledFace: requirements.boardSpec.assembledFace,
                partsSuppliedBy: requirements.boardSpec.partsSuppliedBy,
                toolingHolesAddedBy: requirements.boardSpec.toolingHolesAddedBy,
                conformalCoating: requirements.boardSpec.conformalCoating,
                functionalTest: requirements.boardSpec.functionalTest,
                stencilRequired: requirements.boardSpec.stencilRequired,
                remarks: requirements.boardSpec.remarks,
              },
          { assembly: requirements.assembly },
        ),
    hasBoard,
    hasPrintedPart,
    reviewRequired: reviewSectionsFor({
      packageKind: rfq.package.kind,
      fileCount: files.length,
      bomLineCount: rfq.items.length,
    }),
    reviewSeen: {
      files: recipient.filesViewedAt !== null,
      specification: recipient.specificationViewedAt !== null,
      bom: recipient.bomViewedAt !== null,
    },
    work: {
      packageKind: rfq.package.kind,
      assemblyAsked: requirements.assembly !== 'none',
      // More than one printed piece, or a piece that takes inserts. The
      // platform records the bill of materials rather than a part count, so
      // its presence is what says the build is not a single piece.
      multiPart: rfq.items.length > 0,
      // Panelised only when the *buyer* supplies the panel: a panel the shop
      // arranges itself needs no drawing from them, so asking for one would be
      // a gap that is not the buyer's to fill.
      panelised: requirements.boardSpec?.deliveryFormat === 'panel_by_buyer',
    },
    costKinds: quoteCostKindsFor({
      packageKind: rfq.package.kind,
      assemblyAsked: requirements.assembly !== 'none',
      hardwareAsked: rfq.items.length > 0,
    }),
    requirementsLockedAt: requirements.lockedAt,
    notes: requirements.notes,
    myQuote:
      myQuote === null
        ? null
        : {
            id: myQuote.id,
            status: myQuote.status,
            submittedAt: myQuote.submittedAt,
            unitPriceMinor: Number(myQuote.unitPriceMinor),
            totalPriceMinor: Number(myQuote.totalPriceMinor),
            leadTimeDays: myQuote.leadTimeDays,
            expiresAt: myQuote.expiresAt,
            lifecycle: quoteLifecycle({
              status: myQuote.status,
              expired: myQuote.expiresAt.getTime() < Date.now(),
            }),
            reason: quoteReason({
              status: myQuote.status,
              expiresAt: myQuote.expiresAt,
              expired: myQuote.expiresAt.getTime() < Date.now(),
              now: new Date(),
            }),
            changeable:
              myQuote.status === 'submitted' ||
              myQuote.status === 'revised' ||
              myQuote.status === 'revision_requested',
          },
    draftSuggestionCount: draftQuote?._count.substitutions ?? 0,
    declineReason: recipient.declineReason,
    declineReasonLabel: declineReasonLabel(recipient.declineReason),
    declineNote: recipient.declineNote,
  };
};

/**
 * Records that this shop has opened the request.
 *
 * The buyer's activity screen shows it, which is the point: a request sitting
 * unread is different from one being worked on, and the buyer is entitled to
 * know which it is.
 */
/**
 * Records that this shop has opened one part of a request (UIUX-193).
 *
 * Written the first time only: the column is the moment it was first read, not
 * the last, because what the gate asks is whether the shop has seen it at all.
 * No domain event — this is a reading, and the buyer's activity feed already
 * hears about the request being opened.
 */
export const markSectionViewed = async (
  manufacturerId: ManufacturerId,
  rfqId: RfqId,
  section: ReviewSection,
  now: Date = new Date(),
): Promise<void> => {
  const column =
    section === 'files'
      ? 'filesViewedAt'
      : section === 'specification'
        ? 'specificationViewedAt'
        : 'bomViewedAt';

  const recipient = await database().rfqRecipient.findFirst({
    where: { rfqId, manufacturerId },
    select: { id: true, filesViewedAt: true, specificationViewedAt: true, bomViewedAt: true },
  });
  if (recipient === null) return;
  if (recipient[column] !== null) return;

  await database().rfqRecipient.update({
    where: { id: recipient.id },
    data: { [column]: now },
  });
};

export const markRequestViewed = async (
  manufacturerId: ManufacturerId,
  rfqId: RfqId,
  now: Date = new Date(),
): Promise<void> => {
  const recipient = await database().rfqRecipient.findFirst({
    where: { rfqId, manufacturerId },
    select: { id: true, status: true, viewedAt: true },
  });
  if (recipient === null) return;
  if (recipient.status !== 'routed' && recipient.viewedAt !== null) return;

  await database().$transaction(async (transaction) => {
    await transaction.rfqRecipient.update({
      where: { id: recipient.id },
      data: {
        ...(recipient.status === 'routed' ? { status: 'viewed' as const } : {}),
        ...(recipient.viewedAt === null ? { viewedAt: now } : {}),
      },
    });
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('rfq.recipient_viewed'),
        actorRole: 'manufacturer',
        actorManufacturerId: manufacturerId,
        subjectKind: 'rfq_recipient',
        subjectId: recipient.id,
        payload: {},
        occurredAt: now,
      },
    });
  });
};

export interface DeclineInput {
  readonly reason: RfqDeclineReason;
  readonly note?: string | undefined;
}

/**
 * Declining a request, with the reason recorded.
 *
 * A decline is an answer, not a deletion: the routing record keeps it, the buyer
 * reads it on their request screen, and the reason is one of a fixed list so the
 * two panels describe the same decision in the same words. The recipient state
 * machine is what allows it — a shop that has already quoted cannot then decline,
 * because the quote is out with the buyer.
 */
export const declineRequest = async (
  manufacturerId: ManufacturerId,
  rfqId: RfqId,
  input: DeclineInput,
  now: Date = new Date(),
): Promise<{ readonly ok: true } | { readonly ok: false; readonly message: string }> => {
  const recipient = await database().rfqRecipient.findFirst({
    where: { rfqId, manufacturerId },
    select: { id: true, status: true, rfq: { select: { status: true } } },
  });
  if (recipient === null) {
    return { ok: false, message: 'This request was not routed to your shop.' };
  }
  if (recipient.rfq.status !== 'submitted') {
    return {
      ok: false,
      message: 'This request is no longer open, so there is nothing to answer.',
    };
  }

  const verdict = explainTransition(
    rfqRecipientMachine,
    recipient.status,
    'declined',
    undefined,
  );
  if (!verdict.allowed) {
    return {
      ok: false,
      message:
        recipient.status === 'quoted'
          ? 'You have already sent a quote for this request. Withdraw the quote instead.'
          : `This request cannot be declined: ${verdict.reason ?? 'not allowed'}.`,
    };
  }

  const note = input.note?.trim() ?? '';

  await database().$transaction(async (transaction) => {
    await transaction.rfqRecipient.update({
      where: { id: recipient.id },
      data: {
        status: 'declined',
        declinedAt: now,
        declineReason: input.reason,
        ...(note === '' ? {} : { declineNote: note }),
      },
    });
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('rfq.recipient_declined'),
        actorRole: 'manufacturer',
        actorManufacturerId: manufacturerId,
        subjectKind: 'rfq_recipient',
        subjectId: recipient.id,
        payload: { reason: input.reason, ...(note === '' ? {} : { note }) },
        occurredAt: now,
      },
    });
  });

  return { ok: true };
};
