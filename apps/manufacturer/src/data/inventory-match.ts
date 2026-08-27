import {
  asId,
  assertManufacturerMayReadRfq,
  assertSubstituteSuggestionUsable,
  coverageOf,
  substituteImpact,
  unansweredShortages,
  type CoverageState,
  type ManufacturerId,
  type RfqId,
  type SubstitutionStatus,
} from '@ideeza/domain';
import { toDatabaseEventKind } from '@ideeza/db';
import { database } from '@/lib/db.js';

/**
 * Words worth matching a part name on.
 *
 * Numbers and short words say nothing — "60V" and "2" appear in half an
 * inventory — so only real words are kept.
 */
const nameTokens = (value: string): ReadonlySet<string> =>
  new Set(
    value
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length >= 4),
  );

const sharedWords = (left: string, right: string): number => {
  const words = nameTokens(right);
  let shared = 0;
  for (const word of nameTokens(left)) if (words.has(word)) shared += 1;
  return shared;
};

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface StockCandidate {
  readonly inventoryItemId: string;
  readonly partName: string;
  readonly sku: string;
  readonly category: string;
  readonly available: number;
  readonly unitCostMinor: number;
  readonly currency: string;
  readonly leadTimeDays: number;
  readonly storageLocation: string | null;
  /** True when the shop itself has recorded this as a substitute for the part. */
  readonly declaredSubstitute: boolean;
}

export interface SuggestionView {
  readonly substitutionId: string;
  readonly status: SubstitutionStatus;
  readonly suggestedPartName: string;
  readonly suggestedInventoryItemId: string | null;
  readonly justification: string;
  readonly priceImpactMinor: number;
  readonly leadTimeImpactDays: number;
  readonly decidedAt: Date | null;
}

export interface MatchedLine {
  readonly rfqItemId: string;
  readonly reference: string;
  readonly componentName: string;
  readonly manufacturerPartNumber: string | null;
  readonly sku: string | null;
  readonly quantityPerUnit: number;
  readonly requiredTotal: number;
  /** The shop's own row for the specified part, when it holds it. */
  readonly held: {
    readonly inventoryItemId: string;
    readonly available: number;
    readonly unitCostMinor: number;
    readonly leadTimeDays: number;
  } | null;
  readonly coverage: CoverageState;
  readonly shortfall: number;
  readonly candidates: readonly StockCandidate[];
  readonly suggestion: SuggestionView | null;
}

export interface MatchResult {
  readonly rfqId: RfqId;
  readonly productName: string;
  readonly quantity: number;
  readonly currency: string;
  readonly substitutionPolicy: string;
  readonly substitutionsAllowed: boolean;
  readonly lines: readonly MatchedLine[];
  readonly shortLines: readonly MatchedLine[];
  /** Shortages with nothing suggested: what stops the quote being honest. */
  readonly unanswered: number;
  /** The draft this shop is preparing, when it has started one. */
  readonly draftQuoteId: string | null;
  readonly quoteStatus: string | null;
}

/**
 * The bill of materials matched against this shop's own stock.
 *
 * Matching is by SKU, and only against rows the shop has left enabled for
 * matching: an item it has switched off is one it does not want quoted from.
 * Availability is stock minus what is already reserved for other orders, because
 * a part promised twice is a part that will be late once.
 */
export const matchRequestAgainstInventory = async (
  manufacturerId: ManufacturerId,
  rfqId: RfqId,
): Promise<MatchResult | null> => {
  const recipient = await database().rfqRecipient.findFirst({
    where: { rfqId, manufacturerId },
    select: { rfqId: true, manufacturerId: true },
  });
  if (recipient === null) return null;

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

  const rfq = await database().rfq.findUnique({
    where: { id: rfqId },
    select: {
      id: true,
      quantity: true,
      currency: true,
      requirements: { select: { substitutionPolicy: true } },
      package: { select: { product: { select: { name: true } } } },
      items: { orderBy: { reference: 'asc' } },
    },
  });
  if (rfq === null) return null;

  const inventory = await database().inventoryItem.findMany({
    where: { manufacturerId, enabledForMatching: true },
    include: {
      substitutes: { select: { substituteId: true } },
    },
    orderBy: [{ partName: 'asc' }],
  });

  const quote = await database().quote.findFirst({
    where: { rfqId, manufacturerId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      status: true,
      substitutions: true,
    },
  });

  const available = (item: (typeof inventory)[number]): number =>
    Math.max(0, item.stockQuantity - item.reservedQuantity);

  const bySku = new Map(inventory.map((item) => [item.sku.toLowerCase(), item]));

  const lines: MatchedLine[] = rfq.items.map((item) => {
    const requiredTotal = item.quantityRequired * rfq.quantity;
    const heldItem = item.sku === null ? undefined : bySku.get(item.sku.toLowerCase());
    const coverage = coverageOf({
      requiredTotal,
      available: heldItem === undefined ? null : available(heldItem),
    });

    const declared = new Set(heldItem?.substitutes.map((link) => link.substituteId) ?? []);

    // Only parts the shop holds enough of: a substitute it would also be short
    // of is not an answer. Then, of those, the ones that could plausibly be the
    // same kind of part — what the shop itself declared a substitute, or the same
    // category as the specified part, or, when the part is not in inventory at
    // all and there is no category to go on, a part whose name shares real words
    // with it. The shop still chooses; this only decides what is worth offering.
    const deliverable = inventory
      .filter((candidate) => candidate.id !== heldItem?.id)
      .filter((candidate) => available(candidate) >= requiredTotal);

    const related = deliverable.filter(
      (candidate) =>
        declared.has(candidate.id) ||
        (heldItem !== undefined && candidate.category === heldItem.category) ||
        (heldItem === undefined && sharedWords(item.componentName, candidate.partName) > 0),
    );

    const candidates: StockCandidate[] = (related.length > 0 ? related : deliverable)
      .map((candidate) => ({
        inventoryItemId: candidate.id,
        partName: candidate.partName,
        sku: candidate.sku,
        category: candidate.category,
        available: available(candidate),
        unitCostMinor: Number(candidate.unitCostMinor),
        currency: candidate.currency,
        leadTimeDays: candidate.leadTimeDays,
        storageLocation: candidate.storageLocation,
        declaredSubstitute: declared.has(candidate.id),
      }))
      .sort((left, right) =>
        left.declaredSubstitute === right.declaredSubstitute
          ? left.unitCostMinor - right.unitCostMinor
          : left.declaredSubstitute
            ? -1
            : 1,
      );

    const existing = quote?.substitutions.find(
      (substitution) => substitution.rfqItemId === item.id,
    );

    return {
      rfqItemId: item.id,
      reference: item.reference,
      componentName: item.componentName,
      manufacturerPartNumber: item.manufacturerPartNumber,
      sku: item.sku,
      quantityPerUnit: item.quantityRequired,
      requiredTotal,
      held:
        heldItem === undefined
          ? null
          : {
              inventoryItemId: heldItem.id,
              available: available(heldItem),
              unitCostMinor: Number(heldItem.unitCostMinor),
              leadTimeDays: heldItem.leadTimeDays,
            },
      coverage: coverage.state,
      shortfall: coverage.shortfall,
      candidates,
      suggestion:
        existing === undefined
          ? null
          : {
              substitutionId: existing.id,
              status: existing.status,
              suggestedPartName: existing.suggestedPartName,
              suggestedInventoryItemId: existing.suggestedInventoryItemId,
              justification: existing.technicalJustification,
              priceImpactMinor: Number(existing.priceImpactMinor),
              leadTimeImpactDays: existing.leadTimeImpactDays,
              decidedAt: existing.decidedAt,
            },
    };
  });

  return {
    rfqId: asId<RfqId>(rfq.id),
    productName: rfq.package.product.name,
    quantity: rfq.quantity,
    currency: rfq.currency,
    substitutionPolicy: rfq.requirements.substitutionPolicy,
    substitutionsAllowed: rfq.requirements.substitutionPolicy !== 'not_allowed',
    lines,
    shortLines: lines.filter((line) => line.coverage !== 'covered'),
    unanswered: unansweredShortages(
      lines.map((line) => ({ coverage: line.coverage, hasSuggestion: line.suggestion !== null })),
    ),
    draftQuoteId: quote?.status === 'draft' ? quote.id : null,
    quoteStatus: quote?.status ?? null,
  };
};

export interface SuggestionInput {
  readonly rfqItemId: string;
  /** The inventory row that will stand in, or null to withdraw the suggestion. */
  readonly inventoryItemId: string | null;
  readonly justification: string;
}

export type SuggestionOutcome =
  | { readonly ok: true; readonly quoteId: string; readonly saved: number }
  | { readonly ok: false; readonly message: string };

/**
 * Saves this shop's substitute suggestions for one request.
 *
 * A substitution belongs to a quote, not to a request — it is part of what is
 * being offered — so the suggestions are written onto this shop's draft quote and
 * the draft is created here if it does not exist yet. The draft is private: the
 * buyer's screens read only submitted quotes, so nothing reaches them until the
 * quote is sent.
 *
 * The price and lead-time impact are computed from the shop's own inventory
 * costs rather than typed in twice, so the buyer reads exactly the difference the
 * shop's stock implies.
 */
export const saveSubstituteSuggestions = async (
  manufacturerId: ManufacturerId,
  rfqId: RfqId,
  inputs: readonly SuggestionInput[],
  now: Date = new Date(),
): Promise<SuggestionOutcome> => {
  const match = await matchRequestAgainstInventory(manufacturerId, rfqId);
  if (match === null) {
    return { ok: false, message: 'This request was not routed to your shop.' };
  }

  const rfq = await database().rfq.findUnique({
    where: { id: rfqId },
    select: { status: true, requirements: { select: { leadTimeDays: true } } },
  });
  if (rfq === null || rfq.status !== 'submitted') {
    return { ok: false, message: 'This request is no longer open.' };
  }

  if (match.quoteStatus !== null && match.quoteStatus !== 'draft') {
    return {
      ok: false,
      message:
        'Your quote for this request has already been sent. Revise the quote to change what it proposes.',
    };
  }

  const inventory = await database().inventoryItem.findMany({
    where: { manufacturerId, enabledForMatching: true },
  });

  // Everything is validated before anything is written: a half-saved set of
  // suggestions would be a quote that answers some shortages and hides others.
  const writes: {
    readonly line: (typeof match.lines)[number];
    readonly item: (typeof inventory)[number];
    readonly justification: string;
    readonly priceImpactMinor: number;
    readonly leadTimeImpactDays: number;
  }[] = [];
  const withdrawals: string[] = [];

  for (const input of inputs) {
    const line = match.lines.find((candidate) => candidate.rfqItemId === input.rfqItemId);
    if (line === undefined) {
      return { ok: false, message: 'That line is not on this request.' };
    }

    if (input.inventoryItemId === null) {
      if (line.suggestion !== null) withdrawals.push(line.suggestion.substitutionId);
      continue;
    }

    const item = inventory.find((candidate) => candidate.id === input.inventoryItemId);
    if (item === undefined) {
      return { ok: false, message: 'That part is not in your inventory.' };
    }

    try {
      assertSubstituteSuggestionUsable({
        requestedSku: line.sku,
        substituteSku: item.sku,
        requiredTotal: line.requiredTotal,
        availableOfSubstitute: Math.max(0, item.stockQuantity - item.reservedQuantity),
        substitutionPolicy: match.substitutionPolicy,
        justification: input.justification,
      });
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? `${line.reference}: ${error.message}`
            : `${line.reference}: that substitute cannot be suggested.`,
      };
    }

    const impact = substituteImpact({
      requestedUnitCostMinor: line.held?.unitCostMinor ?? null,
      substituteUnitCostMinor: Number(item.unitCostMinor),
      requiredTotal: line.requiredTotal,
      requestedLeadTimeDays: line.held?.leadTimeDays ?? null,
      substituteLeadTimeDays: item.leadTimeDays,
    });

    writes.push({
      line,
      item,
      justification: input.justification.trim(),
      priceImpactMinor: impact.priceImpactMinor,
      leadTimeImpactDays: impact.leadTimeImpactDays,
    });
  }

  if (writes.length === 0 && withdrawals.length === 0) {
    return { ok: false, message: 'Nothing was chosen, so there is nothing to save.' };
  }

  const quoteId = match.draftQuoteId ?? identifier('quote');

  await database().$transaction(async (transaction) => {
    if (match.draftQuoteId === null) {
      // The shop's private workspace for this request: priced later, in the
      // quoting step. Nothing here is visible to the buyer.
      const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await transaction.quote.create({
        data: {
          id: quoteId,
          rfqId,
          manufacturerId,
          status: 'draft',
          version: 1,
          quantity: match.quantity,
          currency: match.currency,
          unitPriceMinor: 0n,
          totalPriceMinor: 0n,
          leadTimeDays: rfq.requirements.leadTimeDays,
          materialProcessNotes: '',
          terms: '',
          expiresAt: expires,
          createdAt: now,
        },
      });
    }

    for (const id of withdrawals) {
      await transaction.substitution.delete({ where: { id } });
    }

    for (const write of writes) {
      const existing = write.line.suggestion;
      const data = {
        status: 'proposed' as const,
        requestedPartReference: write.line.reference,
        suggestedPartName: write.item.partName,
        suggestedInventoryItemId: write.item.id,
        technicalJustification: write.justification,
        currency: match.currency,
        priceImpactMinor: BigInt(write.priceImpactMinor),
        leadTimeImpactDays: write.leadTimeImpactDays,
        decidedAt: null,
      };

      const substitutionId = existing?.substitutionId ?? identifier('sub');
      if (existing === null) {
        await transaction.substitution.create({
          data: { id: substitutionId, quoteId, rfqItemId: write.line.rfqItemId, ...data },
        });
      } else {
        await transaction.substitution.update({ where: { id: substitutionId }, data });
      }

      // The subject is the substitution itself, which is what the buyer's
      // activity feed reads it back by.
      await transaction.domainEvent.create({
        data: {
          id: identifier('evt'),
          kind: toDatabaseEventKind('substitution.suggested'),
          actorRole: 'manufacturer',
          actorManufacturerId: manufacturerId,
          subjectKind: 'substitution',
          subjectId: substitutionId,
          payload: {
            rfqId,
            reference: write.line.reference,
            suggestedPartName: write.item.partName,
            priceImpactMinor: write.priceImpactMinor,
            leadTimeImpactDays: write.leadTimeImpactDays,
          },
          occurredAt: now,
        },
      });
    }
  });

  return { ok: true, quoteId, saved: writes.length };
};
