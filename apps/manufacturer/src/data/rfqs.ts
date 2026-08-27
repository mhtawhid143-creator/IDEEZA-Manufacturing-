import {
  EMPTY_BOARD_SPECIFICATION,
  PACKAGE_KIND_LABEL,
  asId,
  declineReasonLabel,
  explainTransition,
  assertManufacturerMayReadRfq,
  boardSpecificationRows,
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
  readonly receivedAt: Date;
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
  readonly awaiting: number;
  readonly quoted: number;
  readonly declined: number;
  readonly expired: number;
}

export interface InboxFilters {
  readonly status?: RfqRecipientStatus | 'all';
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
export const listRoutedRequests = async (
  manufacturerId: ManufacturerId,
  filters: InboxFilters = {},
): Promise<InboxPage> => {
  const search = filters.search?.trim() ?? '';
  const pageSize = filters.pageSize ?? 10;

  const where = {
    manufacturerId,
    ...(filters.status === undefined || filters.status === 'all'
      ? {}
      : { status: filters.status }),
    rfq: {
      // A draft is the buyer's private workspace: it was never sent.
      status: { not: 'draft' as const },
      // One `package` filter, so a search and a work-type filter narrow together
      // instead of the second one replacing the first.
      package: {
        ...(filters.kind === undefined || filters.kind === 'all'
          ? {}
          : { kind: filters.kind }),
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
    const quote = quotes.find((candidate) => candidate.rfqId === row.rfqId);
    return {
      rfqId: asId<RfqId>(row.rfqId),
      productName: row.rfq.package.product.name,
      description: row.rfq.requirements.manufacturingMethod,
      kind: row.rfq.package.kind,
      kindLabel: PACKAGE_KIND_LABEL[row.rfq.package.kind],
      quantity: row.rfq.quantity,
      status: row.status,
      receivedAt: row.rfq.submittedAt ?? row.createdAt,
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
  const rows = await database().rfqRecipient.groupBy({
    by: ['status'],
    where: { manufacturerId, rfq: { status: { not: 'draft' } } },
    _count: { _all: true },
  });

  const count = (status: RfqRecipientStatus): number =>
    rows.find((row) => row.status === status)?._count._all ?? 0;

  return {
    total: rows.reduce((total, row) => total + row._count._all, 0),
    awaiting: count('routed') + count('viewed'),
    quoted: count('quoted'),
    declined: count('declined'),
    expired: count('expired'),
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
  readonly hasBoard: boolean;
  readonly hasPrintedPart: boolean;
  readonly requirementsLockedAt: Date | null;
  readonly notes: string | null;
  readonly myQuote: {
    readonly id: string;
    readonly status: string;
    readonly submittedAt: Date | null;
    readonly totalPriceMinor: number;
    readonly leadTimeDays: number;
    readonly expiresAt: Date;
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
          requirements: { include: { boardSpec: true } },
          package: {
            include: {
              product: {
                select: { name: true, owner: { select: { displayName: true } } },
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
    requirementRows: requirementRows(
      {
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
      },
      { includesPrint: hasPrintedPart },
    ),
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
    requirementsLockedAt: requirements.lockedAt,
    notes: requirements.notes,
    myQuote:
      myQuote === null
        ? null
        : {
            id: myQuote.id,
            status: myQuote.status,
            submittedAt: myQuote.submittedAt,
            totalPriceMinor: Number(myQuote.totalPriceMinor),
            leadTimeDays: myQuote.leadTimeDays,
            expiresAt: myQuote.expiresAt,
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
