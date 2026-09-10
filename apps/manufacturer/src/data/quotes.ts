import {
  applyTransition,
  asId,
  assertManufacturerMayReadQuote,
  assertCostLinesExplainUnitPrice,
  assertQuoteTermsUsable,
  assertRequestStillTakesQuotes,
  assertVolumePricesAnswerTheRequest,
  PACKAGE_KIND_LABEL,
  quoteCostKindsFor,
  quoteGoodsTotalMinor,
  quoteHasExpired,
  quoteLandedTotalMinor,
  quoteLifecycle,
  quoteReason,
  quoteMachine,
  rfqRecipientMachine,
  type ManufacturerId,
  type QuoteCostKind,
  type QuoteId,
  type QuoteLifecycle,
  type QuoteReason,
  type QuoteStatus,
  type RfqId,
  type SubstitutionStatus,
} from '@ideeza/domain';
import { ensureRecordThread, postEventCard, toDatabaseEventKind } from '@ideeza/db';
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
  /** Which of the five it is shown as, and why it needs attention (UIUX-177). */
  readonly lifecycle: QuoteLifecycle;
  readonly reason: QuoteReason | null;
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
  /**
   * Lines this shop said it cannot cover (UIUX-162).
   *
   * A quote can carry them and still be a real quote — the buyer takes the rest
   * and decides about the gap — so it is a fact layered on "Quoted" rather than
   * a status of its own.
   */
  readonly unfulfilledParts: number;
  readonly orderId: string | null;
}

/**
 * The four decisions the quotes page is read for (UIUX-179), plus what the
 * removed cards' numbers moved to.
 *
 * Deliberately not one count per status: four slots against five states can
 * only ever be an arbitrary subset, and the subset that matters is the one a
 * shop can act on. `total` stays, but as a denominator beside the table rather
 * than a card — it is lifetime, has no period and nothing to press.
 */
export interface QuoteCounters {
  readonly total: number;
  /** Open and awaiting a buyer decision. */
  readonly live: number;
  /** What those open quotes are worth, landed, if every one were accepted. */
  readonly openValueMinor: number;
  /** Open quotes whose validity runs out within the shared window. */
  readonly expiringSoon: number;
  /** Open quotes waiting on this shop: a revision asked, or a clock running out. */
  readonly requiringAction: number;
  readonly revisionRequested: number;
  readonly accepted: number;
  /** What the accepted quotes were worth. */
  readonly wonValueMinor: number;
  readonly rejected: number;
  readonly expired: number;
  readonly withdrawn: number;
  /**
   * Accepted over decided, never over submitted.
   *
   * A quote still with the buyer is silence, not a loss — the same rule the
   * dashboard's win rate uses, so the two cannot disagree. Null when nothing
   * has been decided, because a shop with no decisions has no rate rather than
   * a rate of zero.
   */
  readonly winRate: number | null;
  readonly currency: string;
}

export interface QuoteFilters {
  /**
   * One of the five the list is partitioned into, or `action` (UIUX-180).
   *
   * `action` is not a status: it is the open quotes with a reason on them, and
   * it is what the alert card above the table filters to. Keeping it out of the
   * status set is what stops a reason being promoted into a sixth state.
   */
  readonly status?: QuoteLifecycle | 'all' | 'action';
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

  // The five displayed states are not stored states: "quoted" is a submitted or
  // revised quote whose clock has not run out, and "expired" is a fact about the
  // clock rather than a column. So the narrowing that SQL can do is done here
  // and the rest is done on the rows, which is why `total` is counted from the
  // filtered set below rather than by the database (UIUX-177, UIUX-180).
  const stored: readonly QuoteStatus[] =
    status === 'quoted' || status === 'action'
      ? ['submitted', 'revised', 'revision_requested']
      : status === 'accepted'
        ? ['accepted']
        : status === 'declined'
          ? ['rejected']
          : status === 'withdrawn'
            ? ['withdrawn']
            : status === 'expired'
              ? ['submitted', 'revised', 'revision_requested', 'expired']
              : [];

  const where = {
    manufacturerId,
    status: stored.length === 0 ? { not: 'draft' as const } : { in: [...stored] },
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

  // Read whole and then narrowed, because the last step of the filter is a
  // judgement about the clock. The set is one shop's own quotes, so it is
  // bounded by the shop rather than by the page.
  const all = await database().quote.findMany({
    where,
    include: listInclude,
    orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
  });

  const matches = all.filter((row) => {
    const expired = quoteHasExpired(row, now);
    const state = quoteLifecycle({ status: row.status, expired });
    if (status === 'action') {
      return (
        state === 'quoted' &&
        quoteReason({ status: row.status, expiresAt: row.expiresAt, expired, now }) !== null
      );
    }
    if (status === 'all') return true;
    return state === status;
  });

  const total = matches.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = matches.slice((page - 1) * pageSize, page * pageSize);

  const mapped = rows.map((row) => ({
    quoteId: asId<QuoteId>(row.id),
    rfqId: asId<RfqId>(row.rfqId),
    productName: row.rfq.package.product.name,
    buyerName: row.rfq.buyer.displayName,
    status: row.status,
    expired: quoteHasExpired(row, now),
    lifecycle: quoteLifecycle({ status: row.status, expired: quoteHasExpired(row, now) }),
    reason: quoteReason({
      status: row.status,
      expiresAt: row.expiresAt,
      expired: quoteHasExpired(row, now),
      now,
    }),
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
    unfulfilledParts: row.substitutions.filter(
      (substitution) => substitution.status === 'unavailable',
    ).length,
    orderId: row.order?.id ?? null,
  }));

  return {
    rows: mapped,
    total,
    page,
    pageCount,
  };
};

export const quoteCounters = async (
  manufacturerId: ManufacturerId,
  now: Date = new Date(),
): Promise<QuoteCounters> => {
  const rows = await database().quote.findMany({
    where: { manufacturerId, status: { not: 'draft' } },
    select: {
      status: true,
      expiresAt: true,
      currency: true,
      totalPriceMinor: true,
      shippingEstimateMinor: true,
      toolingSetupCostMinor: true,
    },
  });

  const count = (status: QuoteStatus): number =>
    rows.filter((row) => row.status === status).length;

  // Read through the same function the rows and the filter read, so a card and
  // the pill on a row it points at cannot disagree about where a quote is.
  const stateOf = (row: (typeof rows)[number]): QuoteLifecycle =>
    quoteLifecycle({ status: row.status, expired: quoteHasExpired(row, now) });

  const landed = (row: (typeof rows)[number]): number =>
    Number(row.totalPriceMinor) +
    Number(row.shippingEstimateMinor ?? 0n) +
    Number(row.toolingSetupCostMinor ?? 0n);

  const open = rows.filter((row) => stateOf(row) === 'quoted');
  const won = rows.filter((row) => stateOf(row) === 'accepted');
  const declined = rows.filter((row) => stateOf(row) === 'declined');
  const attention = open.filter(
    (row) =>
      quoteReason({
        status: row.status,
        expiresAt: row.expiresAt,
        expired: quoteHasExpired(row, now),
        now,
      }) !== null,
  );
  const decided = won.length + declined.length;

  return {
    total: rows.length,
    live: open.length,
    openValueMinor: open.reduce((sum, row) => sum + landed(row), 0),
    expiringSoon: open.filter(
      (row) =>
        quoteReason({
          status: row.status,
          expiresAt: row.expiresAt,
          expired: quoteHasExpired(row, now),
          now,
        }) === 'expiring',
    ).length,
    requiringAction: attention.length,
    revisionRequested: count('revision_requested'),
    accepted: won.length,
    wonValueMinor: won.reduce((sum, row) => sum + landed(row), 0),
    rejected: declined.length,
    expired: rows.filter((row) => stateOf(row) === 'expired').length,
    withdrawn: rows.filter((row) => stateOf(row) === 'withdrawn').length,
    winRate: decided === 0 ? null : won.length / decided,
    currency: rows[0]?.currency ?? 'USD',
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
  /** The project this descends from, and what of it this quote answers. */
  readonly projectId: string;
  readonly kindLabel: string;
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
  /** What one unit's price is made of, as the shop itemised it (UIUX-166). */
  readonly costLines: readonly {
    readonly kind: QuoteCostKind;
    readonly amountMinor: number;
  }[];
  /** The cost lines this request could be priced with, itemised or not. */
  readonly costKinds: readonly QuoteCostKind[];
  /** Requirements this shop said it cannot meet (UIUX-171). */
  readonly deviations: readonly {
    readonly requirement: string;
    readonly capability: string;
  }[];
  /**
   * When the requirements this quote answers were frozen, and whether that is
   * still the frozen date (UIUX-171).
   *
   * A quote that priced an older ask is not wrong, but it is answering a
   * different question, and the shop should be able to see that it is.
   */
  readonly quotedAgainstLockedAt: Date | null;
  readonly specLockedAt: Date | null;
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
          _count: { select: { items: true } },
          package: {
            select: { kind: true, product: { select: { id: true, name: true } } },
          },
          requirements: { select: { assembly: true, lockedAt: true } },
          items: { select: { id: true } },
        },
      },
      substitutions: { orderBy: { createdAt: 'asc' } },
      volumePrices: { orderBy: { quantity: 'asc' } },
      revisions: { orderBy: { version: 'asc' } },
      costLines: true,
      deviations: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (row === null) return null;

  assertManufacturerMayReadQuote(
    { id: asId<QuoteId>(row.id), manufacturerId: asId<ManufacturerId>(row.manufacturerId) },
    manufacturerId,
  );

  const expired = quoteHasExpired(row, now);
  const live = row.status === 'submitted' || row.status === 'revised';
  const lifecycle = quoteLifecycle({ status: row.status, expired });
  const reason = quoteReason({
    status: row.status,
    expiresAt: row.expiresAt,
    expired,
    now,
  });

  return {
    quoteId: asId<QuoteId>(row.id),
    rfqId: asId<RfqId>(row.rfqId),
    productName: row.rfq.package.product.name,
    projectId: row.rfq.package.product.id,
    kindLabel: PACKAGE_KIND_LABEL[row.rfq.package.kind],
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
    unfulfilledParts: row.substitutions.filter(
      (substitution) => substitution.status === 'unavailable',
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
    // Read back in the order the domain offers them, so the breakdown always
    // reads the same way round however it was typed in.
    costKinds: quoteCostKindsFor({
      packageKind: row.rfq.package.kind,
      assemblyAsked: row.rfq.requirements.assembly !== 'none',
      hardwareAsked: row.rfq.items.length > 0,
    }),
    costLines: row.costLines.map((line) => ({
      kind: line.kind,
      amountMinor: Number(line.amountMinor),
    })),
    deviations: row.deviations.map((entry) => ({
      requirement: entry.requirement,
      capability: entry.capability,
    })),
    lifecycle,
    reason,
    quotedAgainstLockedAt: row.quotedAgainstLockedAt,
    specLockedAt: row.rfq.requirements.lockedAt,
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
  /** What the unit price is made of, if the shop itemised it (UIUX-166). */
  readonly costLines?: readonly {
    readonly kind: QuoteCostKind;
    readonly amountMinor: number;
  }[];
  /** Requirements this shop cannot meet, declared before the award (UIUX-171). */
  readonly deviations?: readonly {
    readonly requirement: string;
    readonly capability: string;
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
          package: { select: { kind: true } },
          requirements: { select: { assembly: true, lockedAt: true } },
          // A printed part made of more than one piece can take hardware.
          items: { select: { id: true } },
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
    // The breakdown has to explain the price, not be a second one (UIUX-166),
    // and only the lines this kind of work can carry are accepted.
    assertCostLinesExplainUnitPrice({
      unitPriceMinor: input.unitPriceMinor,
      lines: input.costLines ?? [],
      allowed: quoteCostKindsFor({
        packageKind: recipient.rfq.package.kind,
        assemblyAsked: recipient.rfq.requirements.assembly !== 'none',
        hardwareAsked: recipient.rfq.items.length > 0,
      }),
    });
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
    // Which frozen specification this price answers (UIUX-171).
    quotedAgainstLockedAt: recipient.rfq.requirements.lockedAt,
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

    // Rewritten wholesale rather than merged: the breakdown describes this
    // version of the price, so a line left over from an earlier attempt would
    // make the set stop adding up.
    await transaction.quoteCostLine.deleteMany({ where: { quoteId } });
    if ((input.costLines ?? []).length > 0) {
      await transaction.quoteCostLine.createMany({
        data: (input.costLines ?? []).map((line) => ({
          id: identifier('qcl'),
          quoteId,
          kind: line.kind,
          currency: recipient.rfq.currency,
          amountMinor: BigInt(line.amountMinor),
        })),
      });
    }

    await transaction.quoteDeviation.deleteMany({ where: { quoteId } });
    if ((input.deviations ?? []).length > 0) {
      await transaction.quoteDeviation.createMany({
        data: (input.deviations ?? []).map((entry) => ({
          id: identifier('qdv'),
          quoteId,
          requirement: entry.requirement,
          capability: entry.capability,
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

    const eventId = identifier('evt');
    await transaction.domainEvent.create({
      data: {
        id: eventId,
        kind: toDatabaseEventKind('quote.submitted'),
        actorRole: 'manufacturer',
        actorManufacturerId: manufacturerId,
        subjectKind: 'quote',
        subjectId: quoteId,
        payload: {
          rfqId,
          quantity,
          unitPriceMinor: input.unitPriceMinor,
          totalPriceMinor: goods,
          leadTimeDays: input.leadTimeDays,
        },
        occurredAt: now,
      },
    });

    // The conversation about this request with this buyer, opened by the act
    // that first gives them something to answer, and in the same transaction as
    // the event it announces: a card about a quote that was rolled back would
    // be a card about nothing.
    await postEventCard(transaction, {
      threadId: await ensureRecordThread(transaction, { rfqId, manufacturerId }),
      eventId,
      at: now,
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
      rfq: {
        select: {
          status: true,
          volumeTiers: true,
          responseDeadline: true,
          package: { select: { kind: true } },
          requirements: { select: { assembly: true, lockedAt: true } },
          items: { select: { id: true } },
        },
      },
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
    assertCostLinesExplainUnitPrice({
      unitPriceMinor: input.unitPriceMinor,
      lines: input.costLines ?? [],
      allowed: quoteCostKindsFor({
        packageKind: row.rfq.package.kind,
        assemblyAsked: row.rfq.requirements.assembly !== 'none',
        hardwareAsked: row.rfq.items.length > 0,
      }),
    });
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
        // A revision is priced against whatever is frozen now, which may not be
        // what the first version answered (UIUX-171).
        quotedAgainstLockedAt: row.rfq.requirements.lockedAt,
      },
    });

    // The breakdown and the declared deviations belong to this version of the
    // price, so both are rewritten rather than merged.
    await transaction.quoteCostLine.deleteMany({ where: { quoteId } });
    if ((input.costLines ?? []).length > 0) {
      await transaction.quoteCostLine.createMany({
        data: (input.costLines ?? []).map((line) => ({
          id: identifier('qcl'),
          quoteId,
          kind: line.kind,
          currency: row.currency,
          amountMinor: BigInt(line.amountMinor),
        })),
      });
    }

    await transaction.quoteDeviation.deleteMany({ where: { quoteId } });
    if ((input.deviations ?? []).length > 0) {
      await transaction.quoteDeviation.createMany({
        data: (input.deviations ?? []).map((entry) => ({
          id: identifier('qdv'),
          quoteId,
          requirement: entry.requirement,
          capability: entry.capability,
        })),
      });
    }

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

    const eventId = identifier('evt');
    await transaction.domainEvent.create({
      data: {
        id: eventId,
        kind: toDatabaseEventKind('quote.revised'),
        actorRole: 'manufacturer',
        actorManufacturerId: manufacturerId,
        subjectKind: 'quote',
        subjectId: quoteId,
        payload: {
          version,
          quantity: row.quantity,
          unitPriceMinor: input.unitPriceMinor,
          totalPriceMinor: goods,
          leadTimeDays: input.leadTimeDays,
        },
        occurredAt: now,
      },
    });

    // A buyer who was told the price once has to be told it changed. Same
    // conversation, because it is the same request with the same shop.
    await postEventCard(transaction, {
      threadId: await ensureRecordThread(transaction, { rfqId: row.rfqId, manufacturerId }),
      eventId,
      at: now,
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
