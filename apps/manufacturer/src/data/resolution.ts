import {
  applyTransition,
  asId,
  assertAcceptableRefundAmount,
  disputeMachine,
  refundMachine,
  type ManufacturerId,
  type OrderId,
  type UserId,
  majorAmount,
} from '@ideeza/domain';
import { toDatabaseEventKind } from '@ideeza/db';
import { database } from '@/lib/db.js';

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface RefundClaimView {
  readonly id: string;
  readonly orderId: OrderId;
  readonly productName: string;
  readonly buyerName: string;
  readonly status: string;
  readonly reason: string;
  readonly currency: string;
  readonly requestedAmountMinor: number;
  readonly approvedAmountMinor: number | null;
  readonly description: string;
  readonly respondedAt: Date | null;
  readonly decidedAt: Date | null;
  readonly createdAt: Date;
  /** What the buyer attached to the claim, by title. */
  readonly records: readonly { readonly id: string; readonly title: string }[];
  readonly paidMinor: number;
  /** Open disputes on the same order, so the two are never read apart. */
  readonly disputeId: string | null;
}

export interface DisputeStatementView {
  readonly id: string;
  readonly author: string;
  readonly authorRole: string;
  readonly title: string;
  readonly body: string;
  readonly at: Date;
}

export interface DisputeCaseView {
  readonly id: string;
  readonly orderId: OrderId;
  readonly productName: string;
  readonly buyerName: string;
  readonly status: string;
  readonly reason: string;
  readonly currency: string;
  readonly claimedAmountMinor: number;
  readonly outcome: string | null;
  readonly outcomeAmountMinor: number | null;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
  readonly statements: readonly DisputeStatementView[];
  readonly records: readonly { readonly id: string; readonly title: string }[];
  readonly openedByShop: boolean;
  /** The claim this case came out of, when it came out of one. */
  readonly refundId: string | null;
}

/**
 * The refund claims and disputes on this shop's orders.
 *
 * Both are read together because they are one conversation: a refund the shop
 * challenges becomes a dispute, and a dispute is decided against the refund it
 * came from.
 */
export const listRefundClaims = async (
  manufacturerId: ManufacturerId,
): Promise<readonly RefundClaimView[]> => {
  const rows = await database().refund.findMany({
    where: { order: { manufacturerId } },
    orderBy: { createdAt: 'desc' },
    include: {
      evidence: { select: { id: true, title: true } },
      disputes: { select: { id: true, status: true } },
      order: {
        select: {
          id: true,
          payment: { select: { totalChargedMinor: true } },
          rfq: {
            select: {
              buyer: { select: { displayName: true } },
              package: { select: { product: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    orderId: asId<OrderId>(row.orderId),
    productName: row.order.rfq.package.product.name,
    buyerName: row.order.rfq.buyer.displayName,
    status: row.status,
    reason: row.reason,
    currency: row.currency,
    requestedAmountMinor: Number(row.requestedAmountMinor),
    approvedAmountMinor:
      row.approvedAmountMinor === null ? null : Number(row.approvedAmountMinor),
    description: row.description,
    respondedAt: row.manufacturerRespondedAt,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
    records: row.evidence.map((record) => ({ id: record.id, title: record.title })),
    paidMinor: Number(row.order.payment?.totalChargedMinor ?? 0),
    disputeId: row.disputes[0]?.id ?? null,
  }));
};

export const getRefundClaim = async (
  manufacturerId: ManufacturerId,
  refundId: string,
): Promise<RefundClaimView | null> => {
  const all = await listRefundClaims(manufacturerId);
  return all.find((claim) => claim.id === refundId) ?? null;
};

export const listDisputes = async (
  manufacturerId: ManufacturerId,
): Promise<readonly DisputeCaseView[]> => {
  const rows = await database().dispute.findMany({
    where: { order: { manufacturerId } },
    orderBy: { createdAt: 'desc' },
    include: {
      openedBy: { select: { displayName: true, role: true } },
      evidence: {
        orderBy: { capturedAt: 'asc' },
        include: { submittedBy: { select: { displayName: true, role: true } } },
      },
      order: {
        select: {
          id: true,
          rfq: {
            select: {
              buyer: { select: { displayName: true } },
              package: { select: { product: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    orderId: asId<OrderId>(row.orderId),
    productName: row.order.rfq.package.product.name,
    buyerName: row.order.rfq.buyer.displayName,
    status: row.status,
    reason: row.reason,
    currency: row.currency,
    claimedAmountMinor: Number(row.claimedAmountMinor),
    outcome: row.outcome,
    outcomeAmountMinor:
      row.outcomeAmountMinor === null ? null : Number(row.outcomeAmountMinor),
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    statements: row.evidence
      .filter(
        (record) =>
          record.kind === 'buyer_statement' || record.kind === 'manufacturer_statement',
      )
      .map((record) => ({
        id: record.id,
        author: record.submittedBy?.displayName ?? 'IDEEZA',
        authorRole: record.submittedBy?.role ?? 'ops_admin',
        title: record.title,
        body:
          typeof (record.payload as { readonly detail?: unknown } | null)?.detail ===
          'string'
            ? String((record.payload as { readonly detail?: unknown }).detail)
            : record.title,
        at: record.capturedAt,
      })),
    records: row.evidence
      .filter(
        (record) =>
          record.kind !== 'buyer_statement' && record.kind !== 'manufacturer_statement',
      )
      .map((record) => ({ id: record.id, title: record.title })),
    openedByShop: row.openedBy.role === 'manufacturer',
    refundId: row.refundId,
  }));
};

export const getDisputeCase = async (
  manufacturerId: ManufacturerId,
  disputeId: string,
): Promise<DisputeCaseView | null> => {
  const all = await listDisputes(manufacturerId);
  return all.find((dispute) => dispute.id === disputeId) ?? null;
};

export type ResolutionOutcome =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly message: string };

/**
 * Accepts a refund claim as it stands.
 *
 * The shop agreeing is not the decision: IDEEZA still records the outcome and
 * moves the money, because the platform is holding it. What this does is take the
 * shop's side of the argument off the table.
 */
export const approveRefund = async (
  manufacturerId: ManufacturerId,
  actorId: UserId,
  refundId: string,
  note: string,
  acceptedAmountMinor: number | null = null,
  now: Date = new Date(),
): Promise<ResolutionOutcome> => {
  const refund = await database().refund.findFirst({
    where: { id: refundId, order: { manufacturerId } },
    select: {
      id: true,
      orderId: true,
      status: true,
      currency: true,
      requestedAmountMinor: true,
    },
  });
  if (refund === null) return { ok: false, message: 'That claim is not on your order.' };
  if (refund.status !== 'requested') {
    return { ok: false, message: 'You have already answered this claim.' };
  }

  const claimedMinor = Number(refund.requestedAmountMinor);
  // The design lets a shop answer in full or with a figure of its own. A figure
  // of its own is an offer, not a settlement — operations still moves the money —
  // so it is bounded by what was actually claimed.
  const inFull = acceptedAmountMinor === null || acceptedAmountMinor === claimedMinor;
  if (!inFull) {
    try {
      assertAcceptableRefundAmount({
        acceptedMinor: acceptedAmountMinor,
        claimedMinor,
      });
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'That amount cannot be accepted.',
      };
    }
  }

  const accepted = inFull ? claimedMinor : acceptedAmountMinor;
  const money = (minor: number): string =>
    `${refund.currency} ${majorAmount(minor)}`;

  await database().$transaction(async (transaction) => {
    await transaction.refund.update({
      where: { id: refundId },
      data: {
        status: applyTransition(refundMachine, refund.status, 'mfr_responded', {
          actorRole: 'manufacturer',
        }),
        manufacturerRespondedAt: now,
        // What the shop agreed to, which is what operations decides against.
        approvedAmountMinor: BigInt(accepted),
      },
    });
    await transaction.evidence.create({
      data: {
        id: identifier('evd'),
        contextKind: 'refund',
        kind: 'manufacturer_statement',
        title: inFull
          ? 'The shop accepts this refund claim in full'
          : `The shop accepts ${money(accepted)} of a ${money(claimedMinor)} claim`,
        refundId,
        payload: {
          acceptedAmountMinor: accepted,
          claimedAmountMinor: claimedMinor,
          ...(note.trim() === '' ? {} : { detail: note.trim() }),
        },
        submittedById: actorId,
        capturedAt: now,
      },
    });
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('refund.manufacturer_approved'),
        actorRole: 'manufacturer',
        actorUserId: actorId,
        actorManufacturerId: manufacturerId,
        subjectKind: 'refund',
        subjectId: refundId,
        orderId: refund.orderId,
        payload: { amountMinor: accepted, claimedAmountMinor: claimedMinor },
        occurredAt: now,
      },
    });
  });

  return { ok: true, id: refundId };
};

/**
 * Challenges a refund claim, which opens a dispute.
 *
 * A challenge without a case is just a delay, so the amount the shop would accept
 * and the reason it disagrees are both required. Neither side decides the outcome
 * — that is operations, on the record both sides can read.
 */
export const challengeRefund = async (
  manufacturerId: ManufacturerId,
  actorId: UserId,
  refundId: string,
  input: {
    readonly acceptableAmountMinor: number;
    readonly statement: string;
  },
  now: Date = new Date(),
): Promise<ResolutionOutcome> => {
  const refund = await database().refund.findFirst({
    where: { id: refundId, order: { manufacturerId } },
    select: {
      id: true,
      orderId: true,
      status: true,
      currency: true,
      reason: true,
      requestedAmountMinor: true,
      order: { select: { buyerId: true } },
    },
  });
  if (refund === null) return { ok: false, message: 'That claim is not on your order.' };
  if (refund.status !== 'requested') {
    return { ok: false, message: 'You have already answered this claim.' };
  }
  if (input.statement.trim().length < 20) {
    return {
      ok: false,
      message:
        'Say what happened, in enough detail for operations to weigh it against the buyer’s account.',
    };
  }
  if (
    !Number.isInteger(input.acceptableAmountMinor) ||
    input.acceptableAmountMinor < 0 ||
    input.acceptableAmountMinor > Number(refund.requestedAmountMinor)
  ) {
    return {
      ok: false,
      message: `Offer between nothing and the ${refund.currency} ${majorAmount(
        Number(refund.requestedAmountMinor),
      )} claimed.`,
    };
  }

  const disputeId = identifier('dsp');

  await database().$transaction(async (transaction) => {
    await transaction.refund.update({
      where: { id: refundId },
      data: {
        status: applyTransition(refundMachine, refund.status, 'mfr_responded', {
          actorRole: 'manufacturer',
        }),
        manufacturerRespondedAt: now,
      },
    });
    await transaction.dispute.create({
      data: {
        id: disputeId,
        orderId: refund.orderId,
        refundId,
        openedById: actorId,
        status: 'open',
        reason: refund.reason,
        currency: refund.currency,
        claimedAmountMinor: refund.requestedAmountMinor,
        createdAt: now,
      },
    });
    await transaction.evidence.create({
      data: {
        id: identifier('evd'),
        contextKind: 'dispute',
        kind: 'manufacturer_statement',
        title: 'Why the shop disagrees with this claim',
        disputeId,
        payload: {
          detail: input.statement.trim(),
          acceptableAmountMinor: input.acceptableAmountMinor,
        },
        submittedById: actorId,
        capturedAt: now,
      },
    });
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('refund.manufacturer_challenged'),
        actorRole: 'manufacturer',
        actorUserId: actorId,
        actorManufacturerId: manufacturerId,
        subjectKind: 'refund',
        subjectId: refundId,
        orderId: refund.orderId,
        payload: { acceptableAmountMinor: input.acceptableAmountMinor },
        occurredAt: now,
      },
    });
    await transaction.notification.create({
      data: {
        id: identifier('ntf'),
        recipientId: refund.order.buyerId,
        kind: 'refund_challenged',
        title: 'Your manufacturer has disputed a refund claim',
        body: input.statement.trim().slice(0, 200),
        deepLink: `/manufacturing/orders/${refund.orderId}/dispute/${disputeId}`,
        createdAt: now,
      },
    });
  });

  return { ok: true, id: disputeId };
};

/** Adds a statement to a dispute both sides can read. */
export const addDisputeStatement = async (
  manufacturerId: ManufacturerId,
  actorId: UserId,
  disputeId: string,
  title: string,
  body: string,
  attachedFileIds: readonly string[] = [],
  now: Date = new Date(),
): Promise<ResolutionOutcome> => {
  const dispute = await database().dispute.findFirst({
    where: { id: disputeId, order: { manufacturerId } },
    select: { id: true, orderId: true, status: true },
  });
  if (dispute === null) {
    return { ok: false, message: 'That case is not on your order.' };
  }
  if (dispute.status === 'resolved') {
    return { ok: false, message: 'This case has been decided.' };
  }
  if (body.trim().length < 20) {
    return { ok: false, message: 'Say what you want operations to weigh.' };
  }

  await database().$transaction(async (transaction) => {
    await transaction.evidence.create({
      data: {
        id: identifier('evd'),
        contextKind: 'dispute',
        kind: 'manufacturer_statement',
        title: title.trim() === '' ? 'A statement from the shop' : title.trim(),
        disputeId,
        payload: { detail: body.trim() },
        submittedById: actorId,
        capturedAt: now,
      },
    });
    for (const fileId of attachedFileIds) {
      await transaction.evidence.create({
        data: {
          id: identifier('evd'),
          contextKind: 'dispute',
          kind: 'manufacturer_statement',
          title: 'Attached to a statement from the shop',
          disputeId,
          fileId,
          submittedById: actorId,
          capturedAt: now,
        },
      });
    }
    if (dispute.status === 'open') {
      await transaction.dispute.update({
        where: { id: disputeId },
        data: {
          status: applyTransition(disputeMachine, dispute.status, 'responded', {
            actorRole: 'manufacturer',
          }),
        },
      });
    }
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('dispute.responded'),
        actorRole: 'manufacturer',
        actorUserId: actorId,
        actorManufacturerId: manufacturerId,
        subjectKind: 'dispute',
        subjectId: disputeId,
        orderId: dispute.orderId,
        payload: {},
        occurredAt: now,
      },
    });
  });

  return { ok: true, id: disputeId };
};

export interface AttachableRecord {
  readonly fileId: string;
  readonly name: string;
  readonly origin: string;
}

/**
 * What a shop can attach to a statement on a case.
 *
 * The buyer side has had this since the case screens were built; without it the
 * shop could write about a quality report the case holds no copy of, which is
 * exactly the asymmetry that makes one side's account look thinner than the
 * other's to whoever decides it.
 *
 * Two sources, both already on the order: the files that came with the request,
 * and any file attached to a production record.
 */
export const attachableRecords = async (
  manufacturerId: ManufacturerId,
  orderId: OrderId,
): Promise<readonly AttachableRecord[]> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, manufacturerId },
    select: {
      rfq: {
        select: {
          package: {
            select: { files: { select: { file: { select: { id: true, name: true } } } } },
          },
        },
      },
      stages: {
        select: {
          evidence: {
            select: { kind: true, file: { select: { id: true, name: true } } },
          },
        },
      },
      evidence: { select: { kind: true, file: { select: { id: true, name: true } } } },
    },
  });
  if (order === null) return [];

  const fromStages = order.stages.flatMap((stage) => stage.evidence);
  const records = [...fromStages, ...order.evidence];

  return [
    ...order.rfq.package.files.map((link) => ({
      fileId: link.file.id,
      name: link.file.name,
      origin: 'Sent with the request',
    })),
    ...records.flatMap((record) =>
      record.file === null
        ? []
        : [
            {
              fileId: record.file.id,
              name: record.file.name,
              origin: `Record: ${record.kind.replace(/_/g, ' ')}`,
            },
          ],
    ),
  ];
};
