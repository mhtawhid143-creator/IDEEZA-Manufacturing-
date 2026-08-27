import {
  applyTransition,
  acceptedQuoteCountOnRfq,
  assertSingleAcceptedQuote,
  assertSubstitutionsDecided,
  asId,
  captureAcceptedQuoteSnapshot,
  orderMachine,
  quoteMachine,
  rfqMachine,
  substitutionMachine,
  type ManufacturerId,
  type OrderId,
  type QuoteId,
  type QuoteStatus,
  type RfqId,
  type SubstitutionStatus,
  type UserId,
} from '@ideeza/domain';
import { toDatabaseEventKind } from '@ideeza/db';
import { database } from '@/lib/db.js';

export interface QuoteLineView {
  readonly id: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPriceMinor: bigint;
  readonly lineTotalMinor: bigint;
}

export interface SubstitutionView {
  readonly id: string;
  readonly status: SubstitutionStatus;
  readonly requestedPartReference: string;
  readonly suggestedPartName: string;
  readonly technicalJustification: string;
  readonly priceImpactMinor: bigint;
  readonly leadTimeImpactDays: number;
  readonly decidedAt: Date | null;
}

export interface QuoteVolumeView {
  readonly quantity: number;
  readonly unitPriceMinor: bigint;
  readonly totalPriceMinor: bigint;
  readonly leadTimeDays: number | null;
}

export interface QuoteView {
  readonly id: QuoteId;
  readonly rfqId: RfqId;
  readonly manufacturerId: ManufacturerId;
  readonly manufacturerName: string;
  readonly city: string;
  readonly countryCode: string;
  readonly rating: number | null;
  readonly onTimeDeliveryRate: number | null;
  readonly status: QuoteStatus;
  readonly version: number;
  readonly quantity: number;
  readonly currency: string;
  readonly unitPriceMinor: bigint;
  readonly totalPriceMinor: bigint;
  readonly shippingEstimateMinor: bigint | null;
  readonly toolingSetupCostMinor: bigint | null;
  readonly leadTimeDays: number;
  readonly materialProcessNotes: string;
  readonly warrantyTerms: string | null;
  readonly terms: string;
  readonly expiresAt: Date;
  readonly submittedAt: Date | null;
  readonly acceptedAt: Date | null;
  readonly expired: boolean;
  readonly items: readonly QuoteLineView[];
  /**
   * Prices at the other volumes this request asked about.
   *
   * The buyer asked for them when they sent the request, so an answer has to be
   * readable here rather than buried in the manufacturer's notes.
   */
  readonly volumePrices: readonly QuoteVolumeView[];
  readonly substitutions: readonly SubstitutionView[];
  readonly attachmentNames: readonly string[];
  /** Set once this quote has produced an order. */
  readonly orderId: OrderId | null;
}

const quoteInclude = {
  manufacturer: {
    select: {
      displayName: true,
      city: true,
      countryCode: true,
      rating: true,
      onTimeDeliveryRate: true,
    },
  },
  items: true,
  volumePrices: { orderBy: { quantity: 'asc' } },
  substitutions: { orderBy: { createdAt: 'asc' } },
  attachments: { include: { file: { select: { name: true } } } },
  order: { select: { id: true } },
} as const;

type QuoteRow = {
  readonly id: string;
  readonly rfqId: string;
  readonly manufacturerId: string;
  readonly status: QuoteStatus;
  readonly version: number;
  readonly quantity: number;
  readonly currency: string;
  readonly unitPriceMinor: bigint;
  readonly totalPriceMinor: bigint;
  readonly shippingEstimateMinor: bigint | null;
  readonly toolingSetupCostMinor: bigint | null;
  readonly leadTimeDays: number;
  readonly materialProcessNotes: string;
  readonly warrantyTerms: string | null;
  readonly terms: string;
  readonly expiresAt: Date;
  readonly submittedAt: Date | null;
  readonly acceptedAt: Date | null;
  readonly manufacturer: {
    readonly displayName: string;
    readonly city: string;
    readonly countryCode: string;
    readonly rating: unknown;
    readonly onTimeDeliveryRate: unknown;
  };
  readonly items: readonly {
    readonly id: string;
    readonly description: string;
    readonly quantity: number;
    readonly unitPriceMinor: bigint;
    readonly lineTotalMinor: bigint;
  }[];
  readonly volumePrices: readonly {
    readonly quantity: number;
    readonly unitPriceMinor: bigint;
    readonly totalPriceMinor: bigint;
    readonly leadTimeDays: number | null;
  }[];
  readonly substitutions: readonly {
    readonly id: string;
    readonly status: SubstitutionStatus;
    readonly requestedPartReference: string;
    readonly suggestedPartName: string;
    readonly technicalJustification: string;
    readonly priceImpactMinor: bigint;
    readonly leadTimeImpactDays: number;
    readonly decidedAt: Date | null;
  }[];
  readonly attachments: readonly { readonly file: { readonly name: string } }[];
  readonly order: { readonly id: string } | null;
};

const toView = (row: QuoteRow, now: Date): QuoteView => ({
  id: asId<QuoteId>(row.id),
  rfqId: asId<RfqId>(row.rfqId),
  manufacturerId: asId<ManufacturerId>(row.manufacturerId),
  manufacturerName: row.manufacturer.displayName,
  city: row.manufacturer.city,
  countryCode: row.manufacturer.countryCode,
  rating: row.manufacturer.rating === null ? null : Number(row.manufacturer.rating),
  onTimeDeliveryRate:
    row.manufacturer.onTimeDeliveryRate === null
      ? null
      : Number(row.manufacturer.onTimeDeliveryRate),
  status: row.status,
  version: row.version,
  quantity: row.quantity,
  currency: row.currency,
  unitPriceMinor: row.unitPriceMinor,
  totalPriceMinor: row.totalPriceMinor,
  shippingEstimateMinor: row.shippingEstimateMinor,
  toolingSetupCostMinor: row.toolingSetupCostMinor,
  leadTimeDays: row.leadTimeDays,
  materialProcessNotes: row.materialProcessNotes,
  warrantyTerms: row.warrantyTerms,
  terms: row.terms,
  expiresAt: row.expiresAt,
  submittedAt: row.submittedAt,
  acceptedAt: row.acceptedAt,
  expired: row.status !== 'accepted' && row.expiresAt.getTime() <= now.getTime(),
  items: row.items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    unitPriceMinor: item.unitPriceMinor,
    lineTotalMinor: item.lineTotalMinor,
  })),
  volumePrices: row.volumePrices.map((price) => ({
    quantity: price.quantity,
    unitPriceMinor: price.unitPriceMinor,
    totalPriceMinor: price.totalPriceMinor,
    leadTimeDays: price.leadTimeDays,
  })),
  substitutions: row.substitutions.map((substitution) => ({
    id: substitution.id,
    status: substitution.status,
    requestedPartReference: substitution.requestedPartReference,
    suggestedPartName: substitution.suggestedPartName,
    technicalJustification: substitution.technicalJustification,
    priceImpactMinor: substitution.priceImpactMinor,
    leadTimeImpactDays: substitution.leadTimeImpactDays,
    decidedAt: substitution.decidedAt,
  })),
  attachmentNames: row.attachments.map((attachment) => attachment.file.name),
  orderId: row.order === null ? null : asId<OrderId>(row.order.id),
});

/** The buyer only ever reads quotes on a request that is theirs. */
const ownsRequest = async (buyerId: UserId, rfqId: RfqId): Promise<boolean> =>
  (await database().rfq.count({ where: { id: rfqId, buyerId } })) === 1;

/** Every quote on one request, best price first. */
export const listQuotes = async (
  buyerId: UserId,
  rfqId: RfqId,
  now: Date = new Date(),
): Promise<readonly QuoteView[]> => {
  if (!(await ownsRequest(buyerId, rfqId))) return [];
  const rows = await database().quote.findMany({
    where: { rfqId, status: { not: 'draft' } },
    include: quoteInclude,
    orderBy: [{ totalPriceMinor: 'asc' }, { leadTimeDays: 'asc' }],
  });
  return rows.map((row) => toView(row as unknown as QuoteRow, now));
};

/** One quote, with everything the buyer needs to judge it. */
export const getQuote = async (
  buyerId: UserId,
  quoteId: QuoteId,
  now: Date = new Date(),
): Promise<QuoteView | null> => {
  const row = await database().quote.findFirst({
    where: { id: quoteId, rfq: { buyerId }, status: { not: 'draft' } },
    include: quoteInclude,
  });
  return row === null ? null : toView(row as unknown as QuoteRow, now);
};

export interface ActivityEntry {
  readonly id: string;
  readonly kind: string;
  readonly at: Date;
  readonly actorRole: string;
  readonly manufacturerName: string | null;
  readonly subjectKind: string;
  readonly subjectId: string;
}

/**
 * The activity feed of a request: the append-only event log, read back.
 *
 * Nothing here is derived or embellished — it is the same record a dispute
 * would be decided on.
 */
export const listRequestActivity = async (
  buyerId: UserId,
  rfqId: RfqId,
): Promise<readonly ActivityEntry[]> => {
  if (!(await ownsRequest(buyerId, rfqId))) return [];

  const quoteIds = (
    await database().quote.findMany({ where: { rfqId }, select: { id: true } })
  ).map((quote) => quote.id);
  const orderIds = (
    await database().manufacturingOrder.findMany({ where: { rfqId }, select: { id: true } })
  ).map((order) => order.id);
  // A substitution is its own subject, so its events are found by its own id.
  const substitutionIds = (
    await database().substitution.findMany({
      where: { quoteId: { in: quoteIds } },
      select: { id: true },
    })
  ).map((substitution) => substitution.id);

  const rows = await database().domainEvent.findMany({
    where: {
      OR: [
        { subjectKind: 'rfq', subjectId: rfqId },
        { subjectKind: 'quote', subjectId: { in: quoteIds } },
        { subjectKind: 'substitution', subjectId: { in: substitutionIds } },
        { subjectKind: 'order', subjectId: { in: orderIds } },
        { orderId: { in: orderIds } },
      ],
    },
    include: { actorManufacturer: { select: { displayName: true } } },
    orderBy: { occurredAt: 'desc' },
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    at: row.occurredAt,
    actorRole: row.actorRole,
    manufacturerName: row.actorManufacturer?.displayName ?? null,
    subjectKind: row.subjectKind,
    subjectId: row.subjectId,
  }));
};

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Rejects one quote.
 *
 * A rejected quote is a decision on record, not a deletion: the manufacturer
 * answered, and the buyer said no.
 */
export const rejectQuote = async (
  buyerId: UserId,
  quoteId: QuoteId,
  now: Date = new Date(),
): Promise<void> => {
  const quote = await database().quote.findFirst({
    where: { id: quoteId, rfq: { buyerId } },
    select: { id: true, status: true, rfqId: true },
  });
  if (quote === null) throw new Error('That quote does not exist.');

  const next = applyTransition(quoteMachine, quote.status, 'rejected', {
    acceptedQuoteCountOnRfq: 0,
    pendingSubstitutionCount: 0,
  });

  await database().$transaction(async (transaction) => {
    await transaction.quote.update({ where: { id: quoteId }, data: { status: next } });
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('quote.rejected'),
        actorRole: 'buyer',
        actorUserId: buyerId,
        subjectKind: 'quote',
        subjectId: quoteId,
        payload: { rfqId: quote.rfqId },
        occurredAt: now,
      },
    });
  });
};

/** Approves or rejects a replacement part the manufacturer suggested. */
export const decideSubstitution = async (
  buyerId: UserId,
  substitutionId: string,
  decision: 'approved' | 'rejected',
  now: Date = new Date(),
): Promise<void> => {
  const substitution = await database().substitution.findFirst({
    where: { id: substitutionId, quote: { rfq: { buyerId } } },
    select: { id: true, status: true, quoteId: true },
  });
  if (substitution === null) throw new Error('That suggestion does not exist.');

  const next = applyTransition(substitutionMachine, substitution.status, decision, undefined);

  await database().$transaction(async (transaction) => {
    await transaction.substitution.update({
      where: { id: substitutionId },
      data: { status: next, decidedAt: now },
    });
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind(
          decision === 'approved' ? 'substitution.approved' : 'substitution.rejected',
        ),
        actorRole: 'buyer',
        actorUserId: buyerId,
        subjectKind: 'substitution',
        subjectId: substitutionId,
        payload: { quoteId: substitution.quoteId },
        occurredAt: now,
      },
    });
  });
};

export interface AcceptQuoteResult {
  readonly orderId: OrderId;
}

/**
 * Accepts one quote, which opens an order that is **not** confirmed.
 *
 * This is the rule the whole platform turns on: accepting a quote does not
 * create a confirmed order. The order opens awaiting payment, it carries an
 * immutable checksummed copy of the accepted terms, the request closes, and
 * every other quote on it loses.
 */
export const acceptQuote = async (
  buyerId: UserId,
  quoteId: QuoteId,
  now: Date = new Date(),
): Promise<AcceptQuoteResult> => {
  const quote = await database().quote.findFirst({
    where: { id: quoteId, rfq: { buyerId }, status: { not: 'draft' } },
    include: {
      substitutions: true,
      items: true,
      rfq: {
        include: {
          requirements: true,
          quotes: { select: { id: true, status: true } },
        },
      },
    },
  });
  if (quote === null) throw new Error('That quote does not exist.');
  if (quote.expiresAt.getTime() <= now.getTime()) {
    throw new Error('That quote has expired, so it can no longer be accepted.');
  }

  // Rules from the approved model, in the domain rather than in this function.
  assertSingleAcceptedQuote(
    quote.rfq.quotes.map((candidate) => ({
      id: asId<QuoteId>(candidate.id),
      status: candidate.status,
    })),
    asId<QuoteId>(quote.id),
  );
  assertSubstitutionsDecided(
    quote.substitutions.filter((substitution) => substitution.status === 'proposed').length,
  );

  const acceptedStatus = applyTransition(quoteMachine, quote.status, 'accepted', {
    acceptedQuoteCountOnRfq: acceptedQuoteCountOnRfq(
      quote.rfq.quotes.map((candidate) => ({
        id: asId<QuoteId>(candidate.id),
        status: candidate.status,
      })),
      asId<QuoteId>(quote.id),
    ),
    pendingSubstitutionCount: quote.substitutions.filter(
      (substitution) => substitution.status === 'proposed',
    ).length,
  });
  const rfqClosed = applyTransition(rfqMachine, quote.rfq.status, 'closed', undefined);
  // The order opens in the only state an accepted quote may produce.
  const orderStatus = orderMachine.initial;
  const orderId = identifier('order');

  const requirements = {
    id: quote.rfq.requirements.id,
    packageId: quote.rfq.requirements.packageId,
    quantity: quote.rfq.requirements.quantity,
    material: quote.rfq.requirements.material,
    manufacturingMethod: quote.rfq.requirements.manufacturingMethod,
    tolerance: quote.rfq.requirements.tolerance,
    leadTimeDays: quote.rfq.requirements.leadTimeDays,
    shippingRequirement: quote.rfq.requirements.shippingRequirement,
    assembly: quote.rfq.requirements.assembly,
    qualityCheckRequirement: quote.rfq.requirements.qualityCheckRequirement,
    substitutionPolicy: quote.rfq.requirements.substitutionPolicy,
    notes: quote.rfq.requirements.notes ?? undefined,
    files: [],
    bom: [],
  };

  const approvedSubstitutionIds = quote.substitutions
    .filter((substitution) => substitution.status === 'approved')
    .map((substitution) => substitution.id);

  // The checksum comes from the domain, so the snapshot cannot drift from it.
  const snapshot = captureAcceptedQuoteSnapshot({
    quote: {
      id: asId<QuoteId>(quote.id),
      rfqId: asId<RfqId>(quote.rfqId),
      manufacturerId: asId<ManufacturerId>(quote.manufacturerId),
      status: acceptedStatus,
      version: quote.version,
      quantity: quote.quantity,
      unitPrice: { amountMinor: Number(quote.unitPriceMinor), currency: quote.currency },
      totalPrice: { amountMinor: Number(quote.totalPriceMinor), currency: quote.currency },
      shippingEstimate:
        quote.shippingEstimateMinor === null
          ? undefined
          : { amountMinor: Number(quote.shippingEstimateMinor), currency: quote.currency },
      toolingSetupCost:
        quote.toolingSetupCostMinor === null
          ? undefined
          : { amountMinor: Number(quote.toolingSetupCostMinor), currency: quote.currency },
      leadTimeDays: quote.leadTimeDays,
      materialProcessNotes: quote.materialProcessNotes,
      warrantyTerms: quote.warrantyTerms ?? undefined,
      terms: quote.terms,
      expiresAt: quote.expiresAt.toISOString() as never,
      submittedAt: quote.submittedAt?.toISOString() as never,
      acceptedAt: now.toISOString() as never,
      createdAt: quote.createdAt.toISOString() as never,
      items: [],
      substitutions: [],
      attachments: [],
    } as never,
    requirements: requirements as never,
    approvedSubstitutionIds,
    capturedAt: now.toISOString() as never,
  });

  await database().$transaction(async (transaction) => {
    await transaction.quote.update({
      where: { id: quoteId },
      data: { status: acceptedStatus, acceptedAt: now, acceptedForRfqId: quote.rfqId },
    });

    // Every other quote on this request loses; the losers are recorded as such.
    const losers = quote.rfq.quotes.filter(
      (candidate) => candidate.id !== quote.id && candidate.status === 'submitted',
    );
    for (const loser of losers) {
      await transaction.quote.update({
        where: { id: loser.id },
        data: {
          status: applyTransition(quoteMachine, loser.status, 'rejected', {
            acceptedQuoteCountOnRfq: 0,
            pendingSubstitutionCount: 0,
          }),
        },
      });
    }

    await transaction.rfq.update({
      where: { id: quote.rfqId },
      data: { status: rfqClosed, closedAt: now },
    });

    await transaction.manufacturingOrder.create({
      data: {
        id: orderId,
        rfqId: quote.rfqId,
        acceptedQuoteId: quote.id,
        buyerId,
        manufacturerId: quote.manufacturerId,
        status: orderStatus,
        shipToLine1: quote.rfq.shipToLine1,
        shipToLine2: quote.rfq.shipToLine2,
        shipToCity: quote.rfq.shipToCity,
        shipToRegion: quote.rfq.shipToRegion,
        shipToPostalCode: quote.rfq.shipToPostalCode,
        shipToCountryCode: quote.rfq.shipToCountryCode,
        createdAt: now,
      },
    });

    await transaction.acceptedQuoteSnapshot.create({
      data: {
        orderId,
        quoteId: quote.id,
        quoteVersion: quote.version,
        manufacturerId: quote.manufacturerId,
        quantity: quote.quantity,
        currency: quote.currency,
        unitPriceMinor: quote.unitPriceMinor,
        totalPriceMinor: quote.totalPriceMinor,
        shippingEstimateMinor: quote.shippingEstimateMinor,
        toolingSetupCostMinor: quote.toolingSetupCostMinor,
        leadTimeDays: quote.leadTimeDays,
        materialProcessNotes: quote.materialProcessNotes,
        warrantyTerms: quote.warrantyTerms,
        terms: quote.terms,
        requirements: requirements as never,
        approvedSubstitutionIds,
        checksum: snapshot.checksum,
        capturedAt: now,
      },
    });

    for (const [kind, subjectKind, subjectId] of [
      ['quote.accepted', 'quote', quote.id],
      ['order.created', 'order', orderId],
    ] as const) {
      await transaction.domainEvent.create({
        data: {
          id: identifier('evt'),
          kind: toDatabaseEventKind(kind),
          actorRole: 'buyer',
          actorUserId: buyerId,
          subjectKind,
          subjectId,
          orderId,
          payload: { quoteId: quote.id, rfqId: quote.rfqId },
          occurredAt: now,
        },
      });
    }
  });

  return { orderId: asId<OrderId>(orderId) };
};
