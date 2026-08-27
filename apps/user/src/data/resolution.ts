import {
  applyTransition,
  assertCancellationAllowed,
  assertClaimHasRecord,
  assertClaimWithinPayment,
  assertDisputeOpenable,
  assertNoOpenCancellation,
  assertRefundRequestable,
  assertStatementAllowed,
  asId,
  cancellationRoute,
  orderMachine,
  type CancellationRoute,
  type DisputeStatus,
  type OrderId,
  type OrderIssueReason,
  type OrderStatus,
  type RefundStatus,
  type UserId,
} from '@ideeza/domain';
import { toDatabaseEventKind } from '@ideeza/db';
import type {
  AddDisputeStatementInput,
  CancelOrderInput,
  OpenDisputeInput,
  RequestRefundInput,
} from '@ideeza/types';
import { database } from '@/lib/db.js';

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface AttachableRecord {
  readonly fileId: string;
  readonly name: string;
  readonly origin: string;
}

export interface IssueContext {
  readonly orderId: OrderId;
  readonly status: OrderStatus;
  readonly productName: string;
  readonly manufacturerName: string;
  readonly quantity: number;
  readonly currency: string;
  readonly heldMinor: number;
  readonly paidMinor: number;
  readonly fundsHeld: boolean;
  /** True when the payout already reached the manufacturer. */
  readonly moneyReleased: boolean;
  readonly cancellationRoute: CancellationRoute;
  readonly cancelBlockedReason: string | null;
  readonly refundBlockedReason: string | null;
  readonly disputeBlockedReason: string | null;
  /** Records already on the order that a claim can point at. */
  readonly attachable: readonly AttachableRecord[];
  readonly openRefund: {
    readonly id: string;
    readonly status: RefundStatus;
    readonly reason: OrderIssueReason;
    readonly requestedMinor: number;
    readonly description: string;
    readonly createdAt: Date;
  } | null;
  readonly openDispute: {
    readonly id: string;
    readonly status: DisputeStatus;
    readonly reason: OrderIssueReason;
    readonly claimedMinor: number;
    readonly createdAt: Date;
  } | null;
}

const reasonFor = (run: () => void): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'not available';
  }
};

/**
 * Everything the three issue screens need before the buyer decides anything.
 *
 * Each instrument reports whether it is available and, when it is not, the rule
 * that stops it — so the screen can say "this has already shipped, ask for a
 * refund instead" rather than showing a form that will be refused.
 */
export const getIssueContext = async (
  buyerId: UserId,
  orderId: OrderId,
): Promise<IssueContext | null> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, buyerId },
    include: {
      snapshot: true,
      payment: true,
      manufacturer: { select: { displayName: true } },
      refunds: { orderBy: { createdAt: 'desc' } },
      disputes: { orderBy: { createdAt: 'desc' } },
      rfq: {
        select: {
          package: {
            select: {
              product: { select: { name: true } },
              files: { select: { file: { select: { id: true, name: true } } } },
            },
          },
        },
      },
    },
  });
  if (order === null || order.snapshot === null) return null;

  const fundsHeld =
    order.payment !== null &&
    (order.payment.status === 'secured' || order.payment.status === 'partially_refunded');
  const heldMinor = fundsHeld ? Number(order.payment?.totalChargedMinor ?? 0n) : 0;
  const paidMinor = Number(order.payment?.totalChargedMinor ?? 0n);

  const openRefund =
    order.refunds.find(
      (refund) =>
        refund.status === 'requested' ||
        refund.status === 'mfr_responded' ||
        refund.status === 'ops_review',
    ) ?? null;
  const openDispute = order.disputes.find((dispute) => dispute.status !== 'resolved') ?? null;

  // Quality reports and photographs the manufacturer attached, plus the design
  // files the order was made from: the records a claim can point at today.
  const evidenceRecords = await database().evidence.findMany({
    where: {
      OR: [{ orderId: order.id }, { productionStage: { orderId: order.id } }],
      fileId: { not: null },
    },
    include: { file: { select: { id: true, name: true } } },
  });

  const attachable: AttachableRecord[] = [
    ...order.rfq.package.files.map((link) => ({
      fileId: link.file.id,
      name: link.file.name,
      origin: 'Sent with the request',
    })),
    ...evidenceRecords.flatMap((record) =>
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

  return {
    orderId: asId<OrderId>(order.id),
    status: order.status,
    productName: order.rfq.package.product.name,
    manufacturerName: order.manufacturer.displayName,
    quantity: order.snapshot.quantity,
    currency: order.snapshot.currency,
    heldMinor,
    paidMinor,
    fundsHeld,
    moneyReleased: order.payment?.status === 'released',
    cancellationRoute: cancellationRoute(order.status),
    cancelBlockedReason: reasonFor(() => {
      assertNoOpenCancellation(order.status);
      assertCancellationAllowed(order.id, order.status);
    }),
    refundBlockedReason: reasonFor(() =>
      assertRefundRequestable({
        orderId: order.id,
        orderStatus: order.status,
        paidMinor,
        openRefundCount: openRefund === null ? 0 : 1,
      }),
    ),
    disputeBlockedReason: reasonFor(() =>
      assertDisputeOpenable({
        orderStatus: order.status,
        openDisputeCount: openDispute === null ? 0 : 1,
      }),
    ),
    attachable,
    openRefund:
      openRefund === null
        ? null
        : {
            id: openRefund.id,
            status: openRefund.status,
            reason: openRefund.reason,
            requestedMinor: Number(openRefund.requestedAmountMinor),
            description: openRefund.description,
            createdAt: openRefund.createdAt,
          },
    openDispute:
      openDispute === null
        ? null
        : {
            id: openDispute.id,
            status: openDispute.status,
            reason: openDispute.reason,
            claimedMinor: Number(openDispute.claimedAmountMinor),
            createdAt: openDispute.createdAt,
          },
  };
};

export interface CancelResult {
  readonly orderId: OrderId;
  readonly status: OrderStatus;
  readonly route: CancellationRoute;
}

/**
 * The buyer asks to stop the order.
 *
 * Before the funds are held the buyer withdraws it outright, because nothing has
 * been made and nobody is out of pocket. Once production has started this is a
 * request that IDEEZA decides: the order moves to cancel_requested and stays
 * there, and the manufacturer keeps working until it is decided.
 */
export const cancelOrder = async (
  buyerId: UserId,
  input: CancelOrderInput,
  now: Date = new Date(),
): Promise<CancelResult> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: input.orderId, buyerId },
    include: { payment: true },
  });
  if (order === null) throw new Error('That order does not exist.');

  assertNoOpenCancellation(order.status);
  const route = assertCancellationAllowed(order.id, order.status);

  // The buyer acts as the buyer either way. The machine decides what that is
  // allowed to mean: withdrawing an unfunded order, or asking to stop a funded
  // one.
  const target: OrderStatus = route === 'withdraw' ? 'cancelled' : 'cancel_requested';
  const status = applyTransition(orderMachine, order.status, target, {
    paymentStatus: order.payment?.status,
    actorRole: 'buyer',
  });

  await database().$transaction(async (transaction) => {
    await transaction.manufacturingOrder.update({
      where: { id: order.id },
      data: { status },
    });

    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind(
          route === 'withdraw' ? 'order.cancelled' : 'order.cancel_requested',
        ),
        actorRole: 'buyer',
        actorUserId: buyerId,
        subjectKind: 'order',
        subjectId: order.id,
        orderId: order.id,
        payload: { reason: input.reason, description: input.description, route },
        occurredAt: now,
      },
    });

    await transaction.evidence.create({
      data: {
        id: identifier('ev'),
        contextKind: 'order',
        kind: 'buyer_statement',
        title: `Cancellation ${route === 'withdraw' ? 'withdrawal' : 'request'} — ${input.reason.replace(/_/g, ' ')}`,
        orderId: order.id,
        submittedById: buyerId,
        payload: { reason: input.reason, description: input.description },
        capturedAt: now,
      },
    });
  });

  return { orderId: asId<OrderId>(order.id), status, route };
};

export interface RefundResult {
  readonly refundId: string;
  readonly orderStatus: OrderStatus;
}

/**
 * The buyer asks for money back.
 *
 * The claim is recorded with its reason, its amount and the records it points at,
 * the order moves to refund_requested, and the payout stops: nothing is released
 * to the manufacturer while a claim is open, including the automatic release at
 * the end of the review window.
 */
export const requestRefund = async (
  buyerId: UserId,
  input: RequestRefundInput,
  now: Date = new Date(),
): Promise<RefundResult> => {
  const context = await getIssueContext(buyerId, asId<OrderId>(input.orderId));
  if (context === null) throw new Error('That order does not exist.');

  assertRefundRequestable({
    orderId: String(context.orderId),
    orderStatus: context.status,
    paidMinor: context.paidMinor,
    openRefundCount: context.openRefund === null ? 0 : 1,
  });
  assertClaimWithinPayment(input.requestedAmount.amountMinor, context.paidMinor);
  assertClaimHasRecord({
    statementLength: input.description.trim().length,
    attachedRecordCount: input.evidenceFileIds.length,
  });

  const refundId = identifier('rf');
  const status = applyTransition(orderMachine, context.status, 'refund_requested', {
    actorRole: 'buyer',
  });

  await database().$transaction(async (transaction) => {
    await transaction.refund.create({
      data: {
        id: refundId,
        orderId: String(context.orderId),
        requestedById: buyerId,
        status: 'requested',
        reason: input.reason,
        currency: input.requestedAmount.currency,
        requestedAmountMinor: BigInt(input.requestedAmount.amountMinor),
        description: input.description,
        createdAt: now,
      },
    });

    await transaction.manufacturingOrder.update({
      where: { id: String(context.orderId) },
      data: { status },
    });

    for (const fileId of input.evidenceFileIds) {
      await transaction.evidence.create({
        data: {
          id: identifier('ev'),
          contextKind: 'refund',
          kind: 'buyer_statement',
          title: `Attached to the refund claim`,
          refundId,
          fileId,
          submittedById: buyerId,
          capturedAt: now,
        },
      });
    }

    await transaction.evidence.create({
      data: {
        id: identifier('ev'),
        contextKind: 'refund',
        kind: 'buyer_statement',
        title: `Refund claim — ${input.reason.replace(/_/g, ' ')}`,
        refundId,
        submittedById: buyerId,
        payload: {
          description: input.description,
          requestedAmountMinor: input.requestedAmount.amountMinor,
          expectedOutcome: input.expectedOutcome ?? null,
        },
        capturedAt: now,
      },
    });

    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('refund.requested'),
        actorRole: 'buyer',
        actorUserId: buyerId,
        subjectKind: 'refund',
        subjectId: refundId,
        orderId: String(context.orderId),
        payload: {
          reason: input.reason,
          requestedAmountMinor: input.requestedAmount.amountMinor,
          currency: input.requestedAmount.currency,
        },
        occurredAt: now,
      },
    });
  });

  return { refundId, orderStatus: status };
};

export interface DisputeResult {
  readonly disputeId: string;
  readonly orderStatus: OrderStatus;
}

/**
 * The buyer escalates a contested order.
 *
 * A dispute is decided by IDEEZA on the documented record, so opening one is
 * mostly an act of recording: the claim, the statement and the records it rests
 * on. It can be opened on its own or on top of a refund the manufacturer
 * challenged, which is why it may carry a refund id.
 */
export const openDispute = async (
  buyerId: UserId,
  input: OpenDisputeInput,
  now: Date = new Date(),
): Promise<DisputeResult> => {
  const context = await getIssueContext(buyerId, asId<OrderId>(input.orderId));
  if (context === null) throw new Error('That order does not exist.');

  assertDisputeOpenable({
    orderStatus: context.status,
    openDisputeCount: context.openDispute === null ? 0 : 1,
  });
  assertClaimWithinPayment(input.claimedAmount.amountMinor, context.paidMinor);
  assertClaimHasRecord({
    statementLength: input.statement.trim().length,
    attachedRecordCount: input.evidenceFileIds.length,
  });

  const disputeId = identifier('dp');
  const status = applyTransition(orderMachine, context.status, 'disputed', {
    actorRole: 'buyer',
  });

  await database().$transaction(async (transaction) => {
    await transaction.dispute.create({
      data: {
        id: disputeId,
        orderId: String(context.orderId),
        refundId: input.refundId ?? null,
        openedById: buyerId,
        status: 'open',
        reason: input.reason,
        currency: input.claimedAmount.currency,
        claimedAmountMinor: BigInt(input.claimedAmount.amountMinor),
        createdAt: now,
      },
    });

    await transaction.manufacturingOrder.update({
      where: { id: String(context.orderId) },
      data: { status },
    });

    await transaction.evidence.create({
      data: {
        id: identifier('ev'),
        contextKind: 'dispute',
        kind: 'buyer_statement',
        title: `Opening statement — ${input.reason.replace(/_/g, ' ')}`,
        disputeId,
        submittedById: buyerId,
        payload: { statement: input.statement },
        capturedAt: now,
      },
    });

    for (const fileId of input.evidenceFileIds) {
      await transaction.evidence.create({
        data: {
          id: identifier('ev'),
          contextKind: 'dispute',
          kind: 'buyer_statement',
          title: 'Attached to the opening statement',
          disputeId,
          fileId,
          submittedById: buyerId,
          capturedAt: now,
        },
      });
    }

    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('dispute.opened'),
        actorRole: 'buyer',
        actorUserId: buyerId,
        subjectKind: 'dispute',
        subjectId: disputeId,
        orderId: String(context.orderId),
        payload: {
          reason: input.reason,
          claimedAmountMinor: input.claimedAmount.amountMinor,
          currency: input.claimedAmount.currency,
        },
        occurredAt: now,
      },
    });
  });

  return { disputeId, orderStatus: status };
};

export interface DisputeStatement {
  readonly id: string;
  readonly authorName: string;
  readonly authorRole: string;
  readonly body: string | null;
  readonly fileName: string | null;
  readonly capturedAt: Date;
}

export interface DisputeView {
  readonly id: string;
  readonly orderId: OrderId;
  readonly productName: string;
  readonly manufacturerName: string;
  readonly buyerName: string;
  readonly status: DisputeStatus;
  readonly reason: OrderIssueReason;
  readonly currency: string;
  readonly claimedMinor: number;
  readonly outcome: string | null;
  readonly outcomeMinor: number | null;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
  readonly refundId: string | null;
  readonly statements: readonly DisputeStatement[];
  readonly attachments: readonly { readonly id: string; readonly name: string }[];
  readonly canAddStatement: boolean;
}

/** One dispute, as its parties see it: the case, and everything said in it. */
export const getDispute = async (
  buyerId: UserId,
  disputeId: string,
): Promise<DisputeView | null> => {
  const dispute = await database().dispute.findFirst({
    where: { id: disputeId, order: { buyerId } },
    include: {
      order: {
        select: {
          id: true,
          buyer: { select: { displayName: true } },
          manufacturer: { select: { displayName: true } },
          rfq: { select: { package: { select: { product: { select: { name: true } } } } } },
        },
      },
      evidence: {
        orderBy: { capturedAt: 'asc' },
        include: {
          file: { select: { id: true, name: true } },
          submittedBy: { select: { displayName: true, role: true } },
        },
      },
    },
  });
  if (dispute === null) return null;

  const statements: DisputeStatement[] = dispute.evidence
    .filter((record) => record.fileId === null)
    .map((record) => ({
      id: record.id,
      authorName: record.submittedBy?.displayName ?? 'IDEEZA',
      authorRole: record.submittedBy?.role ?? 'ops_admin',
      body:
        typeof record.payload === 'object' &&
        record.payload !== null &&
        'statement' in record.payload
          ? String((record.payload as { statement?: unknown }).statement ?? '')
          : record.title,
      fileName: null,
      capturedAt: record.capturedAt,
    }));

  return {
    id: dispute.id,
    orderId: asId<OrderId>(dispute.order.id),
    productName: dispute.order.rfq.package.product.name,
    manufacturerName: dispute.order.manufacturer.displayName,
    buyerName: dispute.order.buyer.displayName,
    status: dispute.status,
    reason: dispute.reason,
    currency: dispute.currency,
    claimedMinor: Number(dispute.claimedAmountMinor),
    outcome: dispute.outcome,
    outcomeMinor:
      dispute.outcomeAmountMinor === null ? null : Number(dispute.outcomeAmountMinor),
    resolvedAt: dispute.resolvedAt,
    createdAt: dispute.createdAt,
    refundId: dispute.refundId,
    statements,
    attachments: dispute.evidence.flatMap((record) =>
      record.file === null ? [] : [{ id: record.file.id, name: record.file.name }],
    ),
    canAddStatement: dispute.status !== 'resolved',
  };
};

/** Adds the buyer's further statement to a live dispute. */
export const addDisputeStatement = async (
  buyerId: UserId,
  input: AddDisputeStatementInput,
  now: Date = new Date(),
): Promise<void> => {
  const dispute = await database().dispute.findFirst({
    where: { id: input.disputeId, order: { buyerId } },
    select: { id: true, status: true, orderId: true },
  });
  if (dispute === null) throw new Error('That dispute does not exist.');

  assertStatementAllowed(dispute.status);

  await database().$transaction(async (transaction) => {
    await transaction.evidence.create({
      data: {
        id: identifier('ev'),
        contextKind: 'dispute',
        kind: 'buyer_statement',
        title: 'Further statement',
        disputeId: dispute.id,
        submittedById: buyerId,
        payload: { statement: input.statement },
        capturedAt: now,
      },
    });

    for (const fileId of input.evidenceFileIds) {
      await transaction.evidence.create({
        data: {
          id: identifier('ev'),
          contextKind: 'dispute',
          kind: 'buyer_statement',
          title: 'Attached to a further statement',
          disputeId: dispute.id,
          fileId,
          submittedById: buyerId,
          capturedAt: now,
        },
      });
    }

    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('dispute.responded'),
        actorRole: 'buyer',
        actorUserId: buyerId,
        subjectKind: 'dispute',
        subjectId: dispute.id,
        orderId: dispute.orderId,
        payload: { length: input.statement.length },
        occurredAt: now,
      },
    });
  });
};

/** Every issue raised on one order, for the order screens. */
export const listOrderIssues = async (
  buyerId: UserId,
  orderId: OrderId,
): Promise<{
  readonly refunds: readonly {
    readonly id: string;
    readonly status: RefundStatus;
    readonly reason: OrderIssueReason;
    readonly requestedMinor: number;
    readonly approvedMinor: number | null;
    readonly createdAt: Date;
  }[];
  readonly disputes: readonly {
    readonly id: string;
    readonly status: DisputeStatus;
    readonly reason: OrderIssueReason;
    readonly claimedMinor: number;
    readonly createdAt: Date;
  }[];
}> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, buyerId },
    include: {
      refunds: { orderBy: { createdAt: 'desc' } },
      disputes: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (order === null) return { refunds: [], disputes: [] };

  return {
    refunds: order.refunds.map((refund) => ({
      id: refund.id,
      status: refund.status,
      reason: refund.reason,
      requestedMinor: Number(refund.requestedAmountMinor),
      approvedMinor:
        refund.approvedAmountMinor === null ? null : Number(refund.approvedAmountMinor),
      createdAt: refund.createdAt,
    })),
    disputes: order.disputes.map((dispute) => ({
      id: dispute.id,
      status: dispute.status,
      reason: dispute.reason,
      claimedMinor: Number(dispute.claimedAmountMinor),
      createdAt: dispute.createdAt,
    })),
  };
};
