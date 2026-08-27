import {
  applyTransition,
  asId,
  assertManufacturerMayReadQuote,
  assertQuoteTermsUsable,
  assertRequestStillTakesQuotes,
  assertVolumePricesAnswerTheRequest,
  quoteGoodsTotalMinor,
  quoteHasExpired,
  quoteLandedTotalMinor,
  quoteMachine,
  rfqRecipientMachine,
  type ManufacturerId,
  type QuoteId,
  type QuoteStatus,
  type RfqId,
  type SubstitutionStatus,
} from '@ideeza/domain';
import { toDatabaseEventKind } from '@ideeza/db';
import { database } from '@/lib/db.js';

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface QuoteRow {
  readonly quoteId: QuoteId;
  readonly rfqId: RfqId;
  readonly productName: string;
  readonly buyerName: string;
  readonly status: QuoteStatus;
  readonly expired: boolean;
  readonly quantity: number;
  readonly currency: string;
  readonly unitPriceMinor: number;
  readonly totalPriceMinor: number;
  readonly landedTotalMinor: number;
  readonly leadTimeDays: number;
  readonly submittedAt: Date | null;
  readonly expiresAt: Date;
  readonly version: number;
  readonly pendingSuggestions: number;
  readonly orderId: string | null;
}

export interface QuoteCounters {
  readonly total: number;
  readonly live: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly expired: number;
  readonly revisionRequested: number;
}

export interface QuoteFilters {
  readonly status?: QuoteStatus | 'all' | 'expired';
  readonly search?: string;
  /** Submitted on or after this date, from the design's date-range control. */
  readonly from?: Date;
  readonly to?: Date;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface QuotePage {
  readonly rows: readonly QuoteRow[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

const listInclude = {
  rfq: {
    select: {
      id: true,
      buyer: { select: { displayName: true } },
      package: { select: { product: { select: { name: true } } } },
    },
  },
  substitutions: { select: { status: true } },
  order: { select: { id: true } },
} as const;

/**
 * The quotes this shop has sent.
 *
 * Drafts are excluded on purpose: a draft is the workspace where a shop prepares
 * substitute suggestions and a price, and it has not answered anybody yet. It
 * appears on the request it belongs to, not in the list of what was sent.
 */
export const listQuotes = async (
  manufacturerId: ManufacturerId,
  filters: QuoteFilters = {},
  now: Date = new Date(),
): Promise<QuotePage> => {
  const search = filters.search?.trim() ?? '';
  const pageSize = filters.pageSize ?? 10;
  const status = filters.status ?? 'all';

  const where = {
    manufacturerId,
    status:
      status === 'all' || status === 'expired'
        ? { not: 'draft' as const }
        : (status as QuoteStatus),
    ...(filters.from === undefined && filters.to === undefined
      ? {}
      : {
          submittedAt: {
            ...(filters.from === undefined ? {} : { gte: filters.from }),
            ...(filters.to === undefined ? {} : { lte: filters.to }),
          },
        }),
    ...(search === ''
      ? {}
      : {
          rfq: {
            package: {
              product: { name: { contains: search, mode: 'insensitive' as const } },
            },
          },
        }),
  };

  const total = await database().quote.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);

  const rows = await database().quote.findMany({
    where,
    include: listInclude,
    orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const mapped = rows.map((row) => ({
    quoteId: asId<QuoteId>(row.id),
    rfqId: asId<RfqId>(row.rfqId),
    productName: row.rfq.package.product.name,
    buyerName: row.rfq.buyer.displayName,
    status: row.status,
    expired: quoteHasExpired(row, now),
    quantity: row.quantity,
    currency: row.currency,
    unitPriceMinor: Number(row.unitPriceMinor),
    totalPriceMinor: Number(row.totalPriceMinor),
    landedTotalMinor: quoteLandedTotalMinor({
      quantity: row.quantity,
      unitPriceMinor: Number(row.unitPriceMinor),
      shippingEstimateMinor:
        row.shippingEstimateMinor === null ? null : Number(row.shippingEstimateMinor),
      toolingSetupCostMinor:
        row.toolingSetupCostMinor === null ? null : Number(row.toolingSetupCostMinor),
    }),
    leadTimeDays: row.leadTimeDays,
    submittedAt: row.submittedAt,
    expiresAt: row.expiresAt,
    version: row.version,
    pendingSuggestions: row.substitutions.filter(
      (substitution) => substitution.status === 'proposed',
    ).length,
    orderId: row.order?.id ?? null,
  }));

  // "Expired" is a fact about the clock rather than a stored status, so it is
  // filtered after the rows are read and their expiry judged.
  const visible = status === 'expired' ? mapped.filter((row) => row.expired) : mapped;

  return {
    rows: visible,
    total: status === 'expired' ? visible.length : total,
    page,
    pageCount: status === 'expired' ? 1 : pageCount,
  };
};

export const quoteCounters = async (
  manufacturerId: ManufacturerId,
  now: Date = new Date(),
): Promise<QuoteCounters> => {
  const rows = await database().quote.findMany({
    where: { manufacturerId, status: { not: 'draft' } },
    select: { status: true, expiresAt: true },
  });

  const count = (status: QuoteStatus): number =>
    rows.filter((row) => row.status === status).length;

  return {
    total: rows.length,
    live: rows.filter(
      (row) =>
        (row.status === 'submitted' || row.status === 'revised') &&
        !quoteHasExpired(row, now),
    ).length,
    accepted: count('accepted'),
    rejected: count('rejected'),
    expired: rows.filter((row) => quoteHasExpired(row, now)).length,
    revisionRequested: count('revision_requested'),
  };
};

export interface QuoteSuggestionView {
  readonly id: string;
  readonly status: SubstitutionStatus;
  readonly requestedPartReference: string;
  readonly suggestedPartName: string;
  readonly justification: string;
  readonly priceImpactMinor: number;
  readonly leadTimeImpactDays: number;
  readonly decidedAt: Date | null;
}

export interface QuoteVolumeView {
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly totalPriceMinor: number;
  readonly leadTimeDays: number | null;
}

export interface QuoteRevisionView {
  readonly version: number;
  readonly at: Date;
  readonly buyerNote: string | null;
  readonly requestedByBuyerAt: Date | null;
  readonly previous: {
    readonly unitPriceMinor: number;
    readonly totalPriceMinor: number;
    readonly leadTimeDays: number;
    readonly expiresAt: string;
  } | null;
}

export interface QuoteDetail extends QuoteRow {
  readonly shippingEstimateMinor: number | null;
  readonly toolingSetupCostMinor: number | null;
  readonly materialProcessNotes: string;
  readonly warrantyTerms: string | null;
  readonly terms: string;
  readonly acceptedAt: Date | null;
  readonly createdAt: Date;
  readonly volumePrices: readonly QuoteVolumeView[];
  readonly suggestions: readonly QuoteSuggestionView[];
  readonly revisions: readonly QuoteRevisionView[];
  /** What the request asked for, so the two can be read side by side. */
  readonly requestQuantity: number;
  readonly requestVolumeTiers: readonly number[];
  readonly requestTargetPriceMinor: number | null;
  readonly requestNeededBy: Date | null;
  readonly bomLineCount: number;
  readonly revisable: boolean;
  readonly withdrawable: boolean;
}

/**
 * One quote of this shop's, in full.
 *
 * The access rule is the domain's: a manufacturer may read its own quotes and no
 * others, which is what keeps a buyer's comparison fair.
 */
export const getQuote = async (
  manufacturerId: ManufacturerId,
  quoteId: QuoteId,
  now: Date = new Date(),
): Promise<QuoteDetail | null> => {
  const row = await database().quote.findUnique({
    where: { id: quoteId },
    include: {
      ...listInclude,
      rfq: {
        select: {
          id: true,
          quantity: true,
          volumeTiers: true,
          targetPriceMinor: true,
          neededBy: true,
          buyer: { select: { displayName: true } },
          package: { select: { product: { select: { name: true } } } },
          _count: { select: { items: true } },
        },
      },
      substitutions: { orderBy: { createdAt: 'asc' } },
      volumePrices: { orderBy: { quantity: 'asc' } },
      revisions: { orderBy: { version: 'asc' } },
    },
  });
  if (row === null) return null;

  assertManufacturerMayReadQuote(
    { id: asId<QuoteId>(row.id), manufacturerId: asId<ManufacturerId>(row.manufacturerId) },
    manufacturerId,
  );

  const expired = quoteHasExpired(row, now);
  const live = row.status === 'submitted' || row.status === 'revised';

  return {
    quoteId: asId<QuoteId>(row.id),
    rfqId: asId<RfqId>(row.rfqId),
    productName: row.rfq.package.product.name,
    buyerName: row.rfq.buyer.displayName,
    status: row.status,
    expired,
    quantity: row.quantity,
    currency: row.currency,
    unitPriceMinor: Number(row.unitPriceMinor),
    totalPriceMinor: Number(row.totalPriceMinor),
    landedTotalMinor: quoteLandedTotalMinor({
      quantity: row.quantity,
      unitPriceMinor: Number(row.unitPriceMinor),
      shippingEstimateMinor:
        row.shippingEstimateMinor === null ? null : Number(row.shippingEstimateMinor),
      toolingSetupCostMinor:
        row.toolingSetupCostMinor === null ? null : Number(row.toolingSetupCostMinor),
    }),
    leadTimeDays: row.leadTimeDays,
    submittedAt: row.submittedAt,
    expiresAt: row.expiresAt,
    version: row.version,
    pendingSuggestions: row.substitutions.filter(
      (substitution) => substitution.status === 'proposed',
    ).length,
    orderId: row.order?.id ?? null,
    shippingEstimateMinor:
      row.shippingEstimateMinor === null ? null : Number(row.shippingEstimateMinor),
    toolingSetupCostMinor:
      row.toolingSetupCostMinor === null ? null : Number(row.toolingSetupCostMinor),
    materialProcessNotes: row.materialProcessNotes,
    warrantyTerms: row.warrantyTerms,
    terms: row.terms,
    acceptedAt: row.acceptedAt,
    createdAt: row.createdAt,
    volumePrices: row.volumePrices.map((price) => ({
      quantity: price.quantity,
      unitPriceMinor: Number(price.unitPriceMinor),
      totalPriceMinor: Number(price.totalPriceMinor),
      leadTimeDays: price.leadTimeDays,
    })),
    suggestions: row.substitutions.map((substitution) => ({
      id: substitution.id,
      status: substitution.status,
      requestedPartReference: substitution.requestedPartReference,
      suggestedPartName: substitution.suggestedPartName,
      justification: substitution.technicalJustification,
      priceImpactMinor: Number(substitution.priceImpactMinor),
      leadTimeImpactDays: substitution.leadTimeImpactDays,
      decidedAt: substitution.decidedAt,
    })),
    revisions: row.revisions.map((revision) => {
      const previous = revision.previousTerms as Record<string, unknown> | null;
      return {
        version: revision.version,
        at: revision.createdAt,
        buyerNote: revision.buyerNote,
        requestedByBuyerAt: revision.requestedByBuyerAt,
        previous:
          previous === null
            ? null
            : {
                unitPriceMinor: Number(previous['unitPriceMinor'] ?? 0),
                totalPriceMinor: Number(previous['totalPriceMinor'] ?? 0),
                leadTimeDays: Number(previous['leadTimeDays'] ?? 0),
                expiresAt: String(previous['expiresAt'] ?? ''),
              },
      };
    }),
    requestQuantity: row.rfq.quantity,
    requestVolumeTiers: row.rfq.volumeTiers,
    requestTargetPriceMinor:
      row.rfq.targetPriceMinor === null ? null : Number(row.rfq.targetPriceMinor),
    requestNeededBy: row.rfq.neededBy,
    bomLineCount: row.rfq._count.items,
    revisable: live && !expired,
    withdrawable: (live || row.status === 'revision_requested') && row.order === null,
  };
};

export interface QuoteActivityEntry {
  readonly id: string;
  readonly kind: string;
  readonly at: Date;
  readonly actorRole: string;
}

/**
 * What has happened to this quote, from the append-only log.
 *
 * The same rows the buyer's activity screen reads, filtered to this quote and
 * its suggestions — one record, two readers.
 */
export const listQuoteActivity = async (
  manufacturerId: ManufacturerId,
  quoteId: QuoteId,
): Promise<readonly QuoteActivityEntry[]> => {
  const quote = await database().quote.findUnique({
    where: { id: quoteId },
    select: { id: true, manufacturerId: true, substitutions: { select: { id: true } } },
  });
  if (quote === null) return [];
  assertManufacturerMayReadQuote(
    {
      id: asId<QuoteId>(quote.id),
      manufacturerId: asId<ManufacturerId>(quote.manufacturerId),
    },
    manufacturerId,
  );

  const rows = await database().domainEvent.findMany({
    where: {
      OR: [
        { subjectKind: 'quote', subjectId: quoteId },
        {
          subjectKind: 'substitution',
          subjectId: { in: quote.substitutions.map((substitution) => substitution.id) },
        },
      ],
    },
    orderBy: { occurredAt: 'desc' },
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    at: row.occurredAt,
    actorRole: row.actorRole,
  }));
};

export interface QuoteInput {
  readonly unitPriceMinor: number;
  readonly leadTimeDays: number;
  readonly expiresAt: Date;
  readonly shippingEstimateMinor?: number | null;
  readonly toolingSetupCostMinor?: number | null;
  readonly materialProcessNotes: string;
  readonly warrantyTerms?: string | null;
  readonly terms: string;
  readonly volumePrices?: readonly {
    readonly quantity: number;
    readonly unitPriceMinor: number;
    readonly leadTimeDays?: number | null;
  }[];
}

export type QuoteOutcome =
  | { readonly ok: true; readonly quoteId: QuoteId }
  | { readonly ok: false; readonly message: string };

/**
 * Sends this shop's quote for one request.
 *
 * The draft the shop may already have — where its substitute suggestions live —
 * becomes the quote, so the suggestions travel with it rather than being
 * orphaned. The totals are computed from the unit price and the quantity by the
 * domain, never taken from the form: two numbers that disagree would be a
 * comparison the buyer cannot trust.
 *
 * Submitting also moves this shop's routing record to `quoted`, which is what the
 * buyer's request screen reads.
 */
export const submitQuote = async (
  manufacturerId: ManufacturerId,
  rfqId: RfqId,
  input: QuoteInput,
  now: Date = new Date(),
): Promise<QuoteOutcome> => {
  const recipient = await database().rfqRecipient.findFirst({
    where: { rfqId, manufacturerId },
    select: {
      id: true,
      status: true,
      rfq: {
        select: {
          status: true,
          currency: true,
          quantity: true,
          volumeTiers: true,
          responseDeadline: true,
        },
      },
    },
  });
  if (recipient === null) {
    return { ok: false, message: 'This request was not routed to your shop.' };
  }

  // A quote answers the volume the request asked for. It is read from the
  // request rather than taken from the form, so the two can never disagree.
  const quantity = recipient.rfq.quantity;

  try {
    assertRequestStillTakesQuotes(
      recipient.rfq.status,
      recipient.rfq.responseDeadline,
      now,
    );
    assertQuoteTermsUsable(
      {
        quantity,
        unitPriceMinor: input.unitPriceMinor,
        leadTimeDays: input.leadTimeDays,
        expiresAt: input.expiresAt,
        shippingEstimateMinor: input.shippingEstimateMinor ?? null,
        toolingSetupCostMinor: input.toolingSetupCostMinor ?? null,
        materialProcessNotes: input.materialProcessNotes,
        terms: input.terms,
      },
      now,
    );
    assertVolumePricesAnswerTheRequest(
      input.volumePrices ?? [],
      recipient.rfq.volumeTiers,
      quantity,
    );
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Those terms cannot be sent.',
    };
  }

  const existing = await database().quote.findFirst({
    where: { rfqId, manufacturerId },
    orderBy: { version: 'desc' },
    select: { id: true, status: true },
  });

  if (existing !== null && existing.status !== 'draft') {
    return {
      ok: false,
      message:
        'You have already quoted this request. Revise that quote instead of sending a second one.',
    };
  }

  const quoteId = existing?.id ?? identifier('quote');
  const goods = quoteGoodsTotalMinor({
    quantity,
    unitPriceMinor: input.unitPriceMinor,
  });

  const terms = {
    quantity,
    currency: recipient.rfq.currency,
    unitPriceMinor: BigInt(input.unitPriceMinor),
    totalPriceMinor: BigInt(goods),
    shippingEstimateMinor:
      input.shippingEstimateMinor === null || input.shippingEstimateMinor === undefined
        ? null
        : BigInt(input.shippingEstimateMinor),
    toolingSetupCostMinor:
      input.toolingSetupCostMinor === null || input.toolingSetupCostMinor === undefined
        ? null
        : BigInt(input.toolingSetupCostMinor),
    leadTimeDays: input.leadTimeDays,
    materialProcessNotes: input.materialProcessNotes.trim(),
    warrantyTerms:
      input.warrantyTerms === null || input.warrantyTerms === undefined
        ? null
        : input.warrantyTerms.trim(),
    terms: input.terms.trim(),
    expiresAt: input.expiresAt,
  };

  await database().$transaction(async (transaction) => {
    if (existing === null) {
      await transaction.quote.create({
        data: {
          id: quoteId,
          rfqId,
          manufacturerId,
          status: 'submitted',
          version: 1,
          ...terms,
          submittedAt: now,
          createdAt: now,
        },
      });
    } else {
      await transaction.quote.update({
        where: { id: quoteId },
        data: {
          status: applyTransition(quoteMachine, 'draft', 'submitted', {
            acceptedQuoteCountOnRfq: 0,
            pendingSubstitutionCount: 0,
          }),
          ...terms,
          submittedAt: now,
        },
      });
    }

    await transaction.quoteVolumePrice.deleteMany({ where: { quoteId } });
    if ((input.volumePrices ?? []).length > 0) {
      await transaction.quoteVolumePrice.createMany({
        data: (input.volumePrices ?? []).map((price) => ({
          id: identifier('qvp'),
          quoteId,
          quantity: price.quantity,
          currency: recipient.rfq.currency,
          unitPriceMinor: BigInt(price.unitPriceMinor),
          totalPriceMinor: BigInt(price.unitPriceMinor * price.quantity),
          leadTimeDays:
            price.leadTimeDays === null || price.leadTimeDays === undefined
              ? null
              : price.leadTimeDays,
        })),
      });
    }

    if (recipient.status !== 'quoted') {
      await transaction.rfqRecipient.update({
        where: { id: recipient.id },
        data: {
          status: applyTransition(
            rfqRecipientMachine,
            recipient.status === 'routed' ? 'viewed' : recipient.status,
            'quoted',
            undefined,
          ),
          quotedAt: now,
          ...(recipient.status === 'routed' ? { viewedAt: now } : {}),
        },
      });
    }

    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('quote.submitted'),
        actorRole: 'manufacturer',
        actorManufacturerId: manufacturerId,
        subjectKind: 'quote',
        subjectId: quoteId,
        payload: {
          rfqId,
          unitPriceMinor: input.unitPriceMinor,
          totalPriceMinor: goods,
          leadTimeDays: input.leadTimeDays,
        },
        occurredAt: now,
      },
    });
  });

  return { ok: true, quoteId: asId<QuoteId>(quoteId) };
};

/**
 * Revises a quote that is already with the buyer.
 *
 * The terms that were on the table are kept as a `QuoteRevision` before the new
 * ones are written, because the buyer may have been comparing against them — and
 * if a dispute ever asks what was offered when, the answer has to exist.
 */
export const reviseQuote = async (
  manufacturerId: ManufacturerId,
  quoteId: QuoteId,
  input: QuoteInput,
  now: Date = new Date(),
): Promise<QuoteOutcome> => {
  const row = await database().quote.findUnique({
    where: { id: quoteId },
    include: {
      rfq: { select: { status: true, volumeTiers: true, responseDeadline: true } },
      revisions: { select: { version: true } },
      order: { select: { id: true } },
    },
  });
  if (row === null || row.manufacturerId !== manufacturerId) {
    return { ok: false, message: 'That quote is not yours.' };
  }
  if (row.order !== null) {
    return {
      ok: false,
      message: 'This quote has been accepted and an order is open against it.',
    };
  }

  try {
    assertRequestStillTakesQuotes(row.rfq.status, row.rfq.responseDeadline, now);
    assertQuoteTermsUsable(
      {
        quantity: row.quantity,
        unitPriceMinor: input.unitPriceMinor,
        leadTimeDays: input.leadTimeDays,
        expiresAt: input.expiresAt,
        shippingEstimateMinor: input.shippingEstimateMinor ?? null,
        toolingSetupCostMinor: input.toolingSetupCostMinor ?? null,
        materialProcessNotes: input.materialProcessNotes,
        terms: input.terms,
      },
      now,
    );
    assertVolumePricesAnswerTheRequest(
      input.volumePrices ?? [],
      row.rfq.volumeTiers,
      row.quantity,
    );
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Those terms cannot be sent.',
    };
  }

  let next: QuoteStatus;
  try {
    next = applyTransition(quoteMachine, row.status, 'revised', {
      acceptedQuoteCountOnRfq: 0,
      pendingSubstitutionCount: 0,
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : `A quote that is "${row.status}" cannot be revised.`,
    };
  }

  const goods = quoteGoodsTotalMinor({
    quantity: row.quantity,
    unitPriceMinor: input.unitPriceMinor,
  });
  const version = row.revisions.length + 1;

  await database().$transaction(async (transaction) => {
    await transaction.quoteRevision.create({
      data: {
        id: identifier('qrev'),
        quoteId,
        version,
        previousTerms: {
          quantity: row.quantity,
          unitPriceMinor: Number(row.unitPriceMinor),
          totalPriceMinor: Number(row.totalPriceMinor),
          shippingEstimateMinor:
            row.shippingEstimateMinor === null ? null : Number(row.shippingEstimateMinor),
          toolingSetupCostMinor:
            row.toolingSetupCostMinor === null ? null : Number(row.toolingSetupCostMinor),
          leadTimeDays: row.leadTimeDays,
          materialProcessNotes: row.materialProcessNotes,
          warrantyTerms: row.warrantyTerms,
          terms: row.terms,
          expiresAt: row.expiresAt.toISOString(),
          status: row.status,
        },
        createdAt: now,
      },
    });

    await transaction.quote.update({
      where: { id: quoteId },
      data: {
        status: next,
        unitPriceMinor: BigInt(input.unitPriceMinor),
        totalPriceMinor: BigInt(goods),
        shippingEstimateMinor:
          input.shippingEstimateMinor === null || input.shippingEstimateMinor === undefined
            ? null
            : BigInt(input.shippingEstimateMinor),
        toolingSetupCostMinor:
          input.toolingSetupCostMinor === null || input.toolingSetupCostMinor === undefined
            ? null
            : BigInt(input.toolingSetupCostMinor),
        leadTimeDays: input.leadTimeDays,
        materialProcessNotes: input.materialProcessNotes.trim(),
        warrantyTerms:
          input.warrantyTerms === null || input.warrantyTerms === undefined
            ? null
            : input.warrantyTerms.trim(),
        terms: input.terms.trim(),
        expiresAt: input.expiresAt,
        submittedAt: now,
      },
    });

    await transaction.quoteVolumePrice.deleteMany({ where: { quoteId } });
    if ((input.volumePrices ?? []).length > 0) {
      await transaction.quoteVolumePrice.createMany({
        data: (input.volumePrices ?? []).map((price) => ({
          id: identifier('qvp'),
          quoteId,
          quantity: price.quantity,
          currency: row.currency,
          unitPriceMinor: BigInt(price.unitPriceMinor),
          totalPriceMinor: BigInt(price.unitPriceMinor * price.quantity),
          leadTimeDays:
            price.leadTimeDays === null || price.leadTimeDays === undefined
              ? null
              : price.leadTimeDays,
        })),
      });
    }

    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('quote.revised'),
        actorRole: 'manufacturer',
        actorManufacturerId: manufacturerId,
        subjectKind: 'quote',
        subjectId: quoteId,
        payload: { version, unitPriceMinor: input.unitPriceMinor, totalPriceMinor: goods },
        occurredAt: now,
      },
    });
  });

  return { ok: true, quoteId };
};

/**
 * Withdraws a quote.
 *
 * The routing record keeps saying this shop quoted, because it did: the record is
 * the history of what happened, not a description of what is on the table now.
 * What is on the table is the quote's own status, and the buyer's screens read
 * that.
 */
export const withdrawQuote = async (
  manufacturerId: ManufacturerId,
  quoteId: QuoteId,
  now: Date = new Date(),
): Promise<QuoteOutcome> => {
  const row = await database().quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      manufacturerId: true,
      status: true,
      order: { select: { id: true } },
    },
  });
  if (row === null || row.manufacturerId !== manufacturerId) {
    return { ok: false, message: 'That quote is not yours.' };
  }
  if (row.order !== null) {
    return {
      ok: false,
      message:
        'This quote has been accepted and an order is open against it. Raise a cancellation on the order instead.',
    };
  }

  let next: QuoteStatus;
  try {
    next = applyTransition(quoteMachine, row.status, 'withdrawn', {
      acceptedQuoteCountOnRfq: 0,
      pendingSubstitutionCount: 0,
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : `A quote that is "${row.status}" cannot be withdrawn.`,
    };
  }

  await database().$transaction(async (transaction) => {
    await transaction.quote.update({ where: { id: quoteId }, data: { status: next } });
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('quote.withdrawn'),
        actorRole: 'manufacturer',
        actorManufacturerId: manufacturerId,
        subjectKind: 'quote',
        subjectId: quoteId,
        payload: {},
        occurredAt: now,
      },
    });
  });

  return { ok: true, quoteId };
};
