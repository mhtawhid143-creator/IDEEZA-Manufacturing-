import {
  applyTransition,
  assertDeadlineIsInTheFuture,
  assertDraftEditable,
  assertRecipientCanTakeRequest,
  assertRecipientsSelected,
  assertServicesFitPackage,
  assertServicesRequested,
  assertSpecAgreesWithServices,
  assertVolumeTiersUsable,
  asId,
  compareManufacturerFit,
  evaluateManufacturerFit,
  isOpenRequestStatus,
  requirementRows,
  rfqMachine,
  type AssemblySides,
  type FitAssessment,
  type ManufacturerId,
  type PackageKind,
  type ProductId,
  type QuotedService,
  type RfqId,
  type RfqRecipientStatus,
  type RfqStatus,
  type UserId,
  type DocumentRow,
} from '@ideeza/domain';
import { toDatabaseEventKind } from '@ideeza/db';
import type { SendRequestInput } from '@ideeza/types';
import { database } from '@/lib/db.js';

/** What the request asks for, as the manufacturer list needs to read it. */
export interface FitContext {
  readonly requestedServices: readonly QuotedService[];
  readonly quantity: number;
  readonly leadTimeDays: number;
  /**
   * The request's own bill of materials, so each manufacturer can be read
   * against what it holds in stock.
   *
   * Only the buyer's own lines go in, and only a covered-line count comes back:
   * no manufacturer's quantities, costs or other parts ever cross to the buyer.
   */
  readonly billOfMaterials?: readonly {
    readonly sku: string | null;
    readonly quantityPerUnit: number;
  }[];
}

export interface ManufacturerOption {
  readonly id: ManufacturerId;
  readonly displayName: string;
  readonly city: string;
  readonly countryCode: string;
  readonly rating: number | null;
  readonly onTimeDeliveryRate: number | null;
  readonly completedOrderCount: number;
  readonly verified: boolean;
  readonly services: readonly string[];
  readonly certifications: readonly string[];
  readonly servedRegions: readonly string[];
  readonly minimumOrderQuantity: number | null;
  readonly standardLeadTimeDays: number | null;
  /** Present when the list was read for a specific request. */
  readonly fit?: FitAssessment | undefined;
}

export interface RequestRecipientView {
  readonly manufacturerId: ManufacturerId;
  readonly manufacturerName: string;
  readonly city: string;
  readonly countryCode: string;
  readonly rating: number | null;
  readonly status: RfqRecipientStatus;
  readonly viewedAt: Date | null;
  readonly quotedAt: Date | null;
  readonly declinedAt: Date | null;
  readonly declineReason: string | null;
}

export interface RequestSummary {
  readonly rfqId: RfqId;
  readonly status: RfqStatus;
  readonly productId: ProductId;
  readonly productName: string;
  readonly kind: PackageKind;
  readonly quantity: number;
  readonly submittedAt: Date | null;
  readonly responseDeadline: Date | null;
  readonly recipientCount: number;
  readonly quotedCount: number;
  readonly declinedCount: number;
}

export interface RequestDetail extends RequestSummary {
  readonly requestedServices: readonly QuotedService[];
  readonly assemblySides: AssemblySides | null;
  readonly volumeTiers: readonly number[];
  readonly targetPriceMinor: bigint | null;
  readonly currency: string;
  readonly neededBy: Date | null;
  readonly leadTimeDays: number;
  readonly material: string;
  readonly manufacturingMethod: string;
  readonly tolerance: string;
  readonly assembly: string;
  readonly qualityCheckRequirement: string;
  readonly shippingRequirement: string;
  readonly substitutionPolicy: string;
  readonly notes: string | null;
  readonly requirementsLockedAt: Date | null;
  /**
   * The locked requirements as a document.
   *
   * Read by the domain rather than laid out here, because the manufacturer panel
   * renders the same rows from the same function: one frozen requirement cannot
   * end up worded two ways on the two sides of it.
   */
  readonly requirementRows: readonly DocumentRow[];
  readonly itemCount: number;
  readonly fileCount: number;
  readonly deliveryAddress: {
    readonly line1: string;
    readonly line2: string | null;
    readonly city: string;
    readonly region: string | null;
    readonly postalCode: string | null;
    readonly countryCode: string;
  };
  readonly recipients: readonly RequestRecipientView[];
}

/**
 * Every manufacturer a request may be routed to, best rated first.
 *
 * When the caller says what the request asks for, each option carries its fit,
 * so the card, the refusal and the comparison all read the same assessment.
 */
export const listManufacturers = async (
  context?: FitContext,
): Promise<readonly ManufacturerOption[]> => {
  const rows = await database().manufacturerProfile.findMany({
    include: { capability: true },
    orderBy: [{ rating: 'desc' }, { displayName: 'asc' }],
  });

  // How much of this request's bill of materials each shop can cover from stock.
  // One query for every shop at once, matched by the SKUs the request itself
  // names, and reduced to a count of the buyer's own lines before it leaves this
  // function.
  const lines = (context?.billOfMaterials ?? []).filter(
    (line): line is { sku: string; quantityPerUnit: number } =>
      line.sku !== null && line.sku.trim() !== '',
  );
  const coveredLines = new Map<string, number>();

  if (lines.length > 0 && context !== undefined) {
    const stock = await database().inventoryItem.findMany({
      where: {
        enabledForMatching: true,
        sku: { in: lines.map((line) => line.sku) },
      },
      select: {
        manufacturerId: true,
        sku: true,
        stockQuantity: true,
        reservedQuantity: true,
      },
    });

    for (const item of stock) {
      const line = lines.find(
        (candidate) => candidate.sku.toLowerCase() === item.sku.toLowerCase(),
      );
      if (line === undefined) continue;
      const needed = line.quantityPerUnit * context.quantity;
      const available = Math.max(0, item.stockQuantity - item.reservedQuantity);
      if (available < needed) continue;
      coveredLines.set(
        item.manufacturerId,
        (coveredLines.get(item.manufacturerId) ?? 0) + 1,
      );
    }
  }

  const options = rows.map((row) => ({
    id: asId<ManufacturerId>(row.id),
    displayName: row.displayName,
    city: row.city,
    countryCode: row.countryCode,
    rating: row.rating === null ? null : Number(row.rating),
    onTimeDeliveryRate:
      row.onTimeDeliveryRate === null ? null : Number(row.onTimeDeliveryRate),
    completedOrderCount: row.completedOrderCount,
    verified: row.verifiedAt !== null,
    services: row.capability?.services ?? [],
    certifications: row.capability?.certifications ?? [],
    servedRegions: row.capability?.servedRegions ?? [],
    minimumOrderQuantity: row.capability?.minimumOrderQuantity ?? null,
    standardLeadTimeDays: row.capability?.standardLeadTimeDays ?? null,
    fit:
      context === undefined
        ? undefined
        : evaluateManufacturerFit(context, {
            services: row.capability?.services ?? [],
            minimumOrderQuantity: row.capability?.minimumOrderQuantity ?? null,
            standardLeadTimeDays: row.capability?.standardLeadTimeDays ?? null,
            ...(lines.length === 0
              ? {}
              : {
                  partsInStock: {
                    coveredLines: coveredLines.get(row.id) ?? 0,
                    totalLines: lines.length,
                  },
                }),
          }),
  }));

  // A shop that can do the work and already holds the parts is shown first: the
  // parts being on a shelf is the difference between a lead time that holds and
  // one that hopes.
  return [...options].sort(compareManufacturerFit);
};

const summaryInclude = {
  package: { include: { product: { select: { id: true, name: true } } } },
  requirements: true,
  recipients: {
    include: {
      manufacturer: {
        select: { displayName: true, city: true, countryCode: true, rating: true },
      },
    },
  },
  items: { select: { id: true } },
} as const;

/** The Quote Requests tab: everything the buyer has sent and not closed. */
export const listSubmittedRequests = async (
  buyerId: UserId,
): Promise<readonly RequestSummary[]> => {
  const rows = await database().rfq.findMany({
    where: { buyerId, status: { in: ['submitted', 'closed'] } },
    include: summaryInclude,
    orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
  });

  return rows.map((row) => ({
    rfqId: asId<RfqId>(row.id),
    status: row.status,
    productId: asId<ProductId>(row.package.product.id),
    productName: row.package.product.name,
    kind: row.package.kind,
    quantity: row.quantity,
    submittedAt: row.submittedAt,
    responseDeadline: row.responseDeadline,
    recipientCount: row.recipients.length,
    quotedCount: row.recipients.filter((recipient) => recipient.status === 'quoted').length,
    declinedCount: row.recipients.filter((recipient) => recipient.status === 'declined')
      .length,
  }));
};

/** One request, as its status page needs it. */
export const getRequest = async (
  buyerId: UserId,
  rfqId: RfqId,
): Promise<RequestDetail | null> => {
  const row = await database().rfq.findFirst({
    where: { id: rfqId, buyerId },
    include: {
      ...summaryInclude,
      package: {
        include: {
          product: { select: { id: true, name: true } },
          files: { select: { fileId: true } },
        },
      },
    },
  });

  if (row === null) return null;

  return {
    rfqId: asId<RfqId>(row.id),
    status: row.status,
    productId: asId<ProductId>(row.package.product.id),
    productName: row.package.product.name,
    kind: row.package.kind,
    quantity: row.quantity,
    submittedAt: row.submittedAt,
    responseDeadline: row.responseDeadline,
    recipientCount: row.recipients.length,
    quotedCount: row.recipients.filter((recipient) => recipient.status === 'quoted').length,
    declinedCount: row.recipients.filter((recipient) => recipient.status === 'declined')
      .length,
    requestedServices: row.requestedServices as QuotedService[],
    assemblySides: row.requirements.assemblySides,
    volumeTiers: row.volumeTiers,
    targetPriceMinor: row.targetPriceMinor,
    currency: row.currency,
    neededBy: row.neededBy,
    leadTimeDays: row.requirements.leadTimeDays,
    material: row.requirements.material,
    manufacturingMethod: row.requirements.manufacturingMethod,
    tolerance: row.requirements.tolerance,
    assembly: row.requirements.assembly,
    qualityCheckRequirement: row.requirements.qualityCheckRequirement,
    shippingRequirement: row.requirements.shippingRequirement,
    substitutionPolicy: row.requirements.substitutionPolicy,
    notes: row.requirements.notes,
    requirementsLockedAt: row.requirements.lockedAt,
    requirementRows: requirementRows(
      {
        quantity: row.requirements.quantity,
        material: row.requirements.material,
        manufacturingMethod: row.requirements.manufacturingMethod,
        tolerance: row.requirements.tolerance,
        leadTimeDays: row.requirements.leadTimeDays,
        shippingRequirement: row.requirements.shippingRequirement,
        assembly: row.requirements.assembly,
        assemblySides: row.requirements.assemblySides,
        qualityCheckRequirement: row.requirements.qualityCheckRequirement,
        substitutionPolicy: row.requirements.substitutionPolicy,
        notes: row.requirements.notes,
        printTechnology: row.requirements.printTechnology,
        printMaterial: row.requirements.printMaterial,
        printColor: row.requirements.printColor,
        surfaceFinish: row.requirements.surfaceFinish,
        infillPercent: row.requirements.infillPercent,
      },
      { includesPrint: row.package.kind !== 'pcb' },
    ),
    itemCount: row.items.length,
    fileCount: row.package.files.length,
    deliveryAddress: {
      line1: row.shipToLine1,
      line2: row.shipToLine2,
      city: row.shipToCity,
      region: row.shipToRegion,
      postalCode: row.shipToPostalCode,
      countryCode: row.shipToCountryCode,
    },
    recipients: row.recipients.map((recipient) => ({
      manufacturerId: asId<ManufacturerId>(recipient.manufacturerId),
      manufacturerName: recipient.manufacturer.displayName,
      city: recipient.manufacturer.city,
      countryCode: recipient.manufacturer.countryCode,
      rating:
        recipient.manufacturer.rating === null ? null : Number(recipient.manufacturer.rating),
      status: recipient.status,
      viewedAt: recipient.viewedAt,
      quotedAt: recipient.quotedAt,
      declinedAt: recipient.declinedAt,
      declineReason: recipient.declineReason,
    })),
  };
};

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Sends a prepared draft to the manufacturers the buyer chose.
 *
 * This is the moment the request stops being editable: the requirements are
 * locked, the bill of materials is written onto the request as the version every
 * recipient quotes against, and one routing row is created per manufacturer. All
 * of it in one transaction, because a request that was half sent would be
 * quoted against inputs that never existed.
 */
export const submitRequest = async (
  buyerId: UserId,
  input: SendRequestInput,
  now: Date = new Date(),
): Promise<RfqId> => {
  const rfqId = asId<RfqId>(input.rfqId);
  const manufacturerIds = input.manufacturerIds.map((id) => asId<ManufacturerId>(id));

  assertServicesRequested(input.requestedServices);
  assertRecipientsSelected(manufacturerIds);
  assertVolumeTiersUsable(input.volumeTiers);
  assertDeadlineIsInTheFuture(input.responseDeadline, now);

  const existing = await database().rfq.findFirst({
    where: { id: rfqId, buyerId },
    include: {
      package: { include: { bomLines: { include: { bomLine: true } } } },
      requirements: {
        select: { id: true, leadTimeDays: true, boardSpec: true },
      },
    },
  });
  if (existing === null) throw new Error('That request does not exist.');
  assertDraftEditable(rfqId, existing.status);
  // A printer cannot be asked for assembly, and a board house cannot be asked
  // for an enclosure that is not in the package.
  assertServicesFitPackage(existing.package.kind, input.requestedServices);
  // A specification that contradicts what is being quoted is the commonest way a
  // request comes back unusable, so the two are checked against each other here.
  if (existing.requirements.boardSpec !== null) {
    assertSpecAgreesWithServices(
      {
        ...(existing.requirements.boardSpec.partsSuppliedBy === null
          ? {}
          : { partsSuppliedBy: existing.requirements.boardSpec.partsSuppliedBy }),
        stencilRequired: existing.requirements.boardSpec.stencilRequired,
      },
      input.requestedServices,
    );
  }

  const known = await database().manufacturerProfile.findMany({
    where: { id: { in: [...manufacturerIds] } },
    include: { capability: true },
  });
  if (known.length !== manufacturerIds.length) {
    throw new Error('One of those manufacturers does not exist.');
  }

  // A manufacturer that could only decline is not a recipient.
  for (const manufacturer of known) {
    assertRecipientCanTakeRequest(
      manufacturer.displayName,
      evaluateManufacturerFit(
        {
          requestedServices: input.requestedServices,
          quantity: input.quantity,
          leadTimeDays: existing.requirements.leadTimeDays,
        },
        {
          services: manufacturer.capability?.services ?? [],
          minimumOrderQuantity: manufacturer.capability?.minimumOrderQuantity ?? null,
          standardLeadTimeDays: manufacturer.capability?.standardLeadTimeDays ?? null,
        },
      ),
    );
  }

  const next = applyTransition(rfqMachine, existing.status, 'submitted', undefined);

  await database().$transaction(async (transaction) => {
    // The requirements freeze here: from now on every recipient answers the
    // same question.
    await transaction.manufacturingRequirements.update({
      where: { id: existing.requirements.id },
      data: {
        lockedAt: now,
        assembly: input.assembly,
        assemblySides: input.assemblySides ?? null,
        ...(input.notes === undefined ? {} : { notes: input.notes }),
      },
    });

    await transaction.rfqItem.deleteMany({ where: { rfqId } });
    if (existing.package.bomLines.length > 0) {
      await transaction.rfqItem.createMany({
        data: existing.package.bomLines.map((link) => ({
          id: identifier('rfqitem'),
          rfqId,
          reference: link.bomLine.reference,
          componentName: link.bomLine.componentName,
          manufacturerPartNumber: link.bomLine.manufacturerPartNumber,
          sku: link.bomLine.sku,
          quantityRequired: link.bomLine.quantityPerUnit * input.quantity,
        })),
      });
    }

    await transaction.rfqRecipient.createMany({
      data: manufacturerIds.map((manufacturerId) => ({
        id: identifier('recipient'),
        rfqId,
        manufacturerId,
        status: 'routed' as const,
        ...(input.responseDeadline === undefined
          ? {}
          : { expiresAt: input.responseDeadline }),
      })),
    });

    await transaction.rfq.update({
      where: { id: rfqId },
      data: {
        status: next,
        submittedAt: now,
        quantity: input.quantity,
        requestedServices: [...input.requestedServices],
        volumeTiers: [...input.volumeTiers],
        targetPriceMinor:
          input.targetPriceMinor === undefined ? null : BigInt(input.targetPriceMinor),
        neededBy: input.neededBy ?? null,
        responseDeadline: input.responseDeadline ?? null,
        shipToLine1: input.deliveryAddress.line1,
        shipToLine2: input.deliveryAddress.line2 ?? null,
        shipToCity: input.deliveryAddress.city,
        shipToRegion: input.deliveryAddress.region ?? null,
        shipToPostalCode: input.deliveryAddress.postalCode ?? null,
        shipToCountryCode: input.deliveryAddress.countryCode,
      },
    });

    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('rfq.submitted'),
        actorRole: 'buyer',
        actorUserId: buyerId,
        subjectKind: 'rfq',
        subjectId: rfqId,
        payload: {
          recipients: manufacturerIds.length,
          quantity: input.quantity,
          services: [...input.requestedServices],
        },
        occurredAt: now,
      },
    });
  });

  return rfqId;
};

/**
 * Sends an open request to more manufacturers.
 *
 * The request is not re-opened and the requirements stay locked: the new
 * recipients answer exactly the question the first ones were asked, which is
 * what keeps every quote comparable.
 */
export const addRecipients = async (
  buyerId: UserId,
  rfqId: RfqId,
  manufacturerIdsInput: readonly string[],
  now: Date = new Date(),
): Promise<number> => {
  const manufacturerIds = manufacturerIdsInput.map((id) => asId<ManufacturerId>(id));
  assertRecipientsSelected(manufacturerIds);

  const existing = await database().rfq.findFirst({
    where: { id: rfqId, buyerId },
    include: {
      requirements: { select: { leadTimeDays: true } },
      recipients: { select: { manufacturerId: true } },
    },
  });
  if (existing === null) throw new Error('That request does not exist.');
  if (!isOpenRequestStatus(existing.status)) {
    throw new Error('That request is closed, so it cannot be sent to anyone else.');
  }

  const already = new Set(existing.recipients.map((recipient) => recipient.manufacturerId));
  const fresh = manufacturerIds.filter((id) => !already.has(id));
  if (fresh.length === 0) return 0;
  assertRecipientsSelected([...already, ...fresh].map((id) => asId<ManufacturerId>(id)));

  const known = await database().manufacturerProfile.findMany({
    where: { id: { in: [...fresh] } },
    include: { capability: true },
  });
  if (known.length !== fresh.length) {
    throw new Error('One of those manufacturers does not exist.');
  }
  for (const manufacturer of known) {
    assertRecipientCanTakeRequest(
      manufacturer.displayName,
      evaluateManufacturerFit(
        {
          requestedServices: existing.requestedServices as QuotedService[],
          quantity: existing.quantity,
          leadTimeDays: existing.requirements.leadTimeDays,
        },
        {
          services: manufacturer.capability?.services ?? [],
          minimumOrderQuantity: manufacturer.capability?.minimumOrderQuantity ?? null,
          standardLeadTimeDays: manufacturer.capability?.standardLeadTimeDays ?? null,
        },
      ),
    );
  }

  await database().$transaction(async (transaction) => {
    await transaction.rfqRecipient.createMany({
      data: fresh.map((manufacturerId) => ({
        id: identifier('recipient'),
        rfqId,
        manufacturerId,
        status: 'routed' as const,
        ...(existing.responseDeadline === null
          ? {}
          : { expiresAt: existing.responseDeadline }),
      })),
    });
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('rfq.submitted'),
        actorRole: 'buyer',
        actorUserId: buyerId,
        subjectKind: 'rfq',
        subjectId: rfqId,
        payload: { recipientsAdded: fresh.length },
        occurredAt: now,
      },
    });
  });

  return fresh.length;
};

/**
 * Withdraws a request that is out for quotes.
 *
 * Allowed while no quote has been accepted, which is why the buyer is told they
 * can withdraw before a manufacturer responds.
 */
export const withdrawRequest = async (
  buyerId: UserId,
  rfqId: RfqId,
  now: Date = new Date(),
): Promise<void> => {
  const existing = await database().rfq.findFirst({
    where: { id: rfqId, buyerId },
    select: { id: true, status: true },
  });
  if (existing === null) throw new Error('That request does not exist.');

  const next = applyTransition(rfqMachine, existing.status, 'withdrawn', undefined);

  await database().$transaction(async (transaction) => {
    await transaction.rfq.update({
      where: { id: rfqId },
      data: { status: next, closedAt: now },
    });
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('rfq.withdrawn'),
        actorRole: 'buyer',
        actorUserId: buyerId,
        subjectKind: 'rfq',
        subjectId: rfqId,
        payload: { from: existing.status },
        occurredAt: now,
      },
    });
  });
};

export interface HubCounts {
  readonly drafts: number;
  readonly requests: number;
  readonly active: number;
  readonly history: number;
}

/**
 * The counts the hub tabs carry.
 *
 * Drafts are requests not yet sent, requests are the ones out for quotes,
 * active orders are the orders still being produced and history is what is
 * finished.
 */
export const hubCounts = async (buyerId: UserId): Promise<HubCounts> => {
  const [drafts, requests, active, history] = await Promise.all([
    database().rfq.count({ where: { buyerId, status: 'draft' } }),
    database().rfq.count({ where: { buyerId, status: 'submitted' } }),
    database().manufacturingOrder.count({
      where: {
        buyerId,
        status: {
          in: [
            'awaiting_payment',
            'confirmed',
            'in_production',
            'quality_check',
            'ready_to_ship',
            'shipped',
            'delivered',
          ],
        },
      },
    }),
    // A delivered order is counted in both: production is over, so it belongs
    // in history, and the buyer still has a decision to make on it.
    database().manufacturingOrder.count({
      where: {
        buyerId,
        status: {
          in: [
            'delivered',
            'completed',
            'cancelled',
            'refunded',
            'partially_refunded',
            'resolved',
          ],
        },
      },
    }),
  ]);
  return { drafts, requests, active, history };
};
