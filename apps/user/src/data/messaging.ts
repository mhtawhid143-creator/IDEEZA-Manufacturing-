import { asId, type OrderId, type RfqId, type UserId } from '@ideeza/domain';
import { toDomainEventKind } from '@ideeza/db';
import type { SendMessageInput } from '@ideeza/types';
import { database } from '@/lib/db.js';

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface ThreadSummary {
  readonly threadId: string;
  readonly contextKind: string;
  /** What the thread is about, in the buyer's words. */
  readonly contextLabel: string;
  readonly contextHref: string | null;
  readonly counterpartName: string;
  readonly lastMessageAt: Date | null;
  readonly lastMessagePreview: string | null;
  readonly unreadCount: number;
}

export interface ThreadEventCard {
  readonly kind: string;
  readonly title: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
  readonly actions: readonly { readonly label: string; readonly href: string }[];
}

export interface ThreadMessage {
  readonly id: string;
  readonly authorName: string;
  readonly authorRole: string;
  readonly mine: boolean;
  readonly body: string | null;
  readonly sentAt: Date;
  readonly card: ThreadEventCard | null;
  readonly attachments: readonly string[];
}

export interface ThreadView {
  readonly threadId: string;
  readonly contextKind: string;
  readonly contextLabel: string;
  readonly contextHref: string | null;
  readonly counterpartName: string;
  readonly messages: readonly ThreadMessage[];
  readonly actions: readonly { readonly label: string; readonly href: string }[];
}

const threadInclude = {
  participants: { include: { user: { select: { id: true, displayName: true, role: true } } } },
  rfq: {
    select: {
      id: true,
      package: { select: { product: { select: { name: true } } } },
    },
  },
  quote: { select: { id: true, rfqId: true, manufacturer: { select: { displayName: true } } } },
  order: {
    select: {
      id: true,
      rfqId: true,
      manufacturer: { select: { displayName: true } },
      rfq: { select: { package: { select: { product: { select: { name: true } } } } } },
    },
  },
  dispute: { select: { id: true, orderId: true } },
} as const;

type ThreadRow = {
  readonly id: string;
  readonly contextKind: string;
  readonly lastMessageAt: Date | null;
  readonly participants: readonly {
    readonly userId: string;
    readonly lastReadAt: Date | null;
    readonly user: { readonly displayName: string; readonly role: string };
  }[];
  readonly rfq: {
    readonly id: string;
    readonly package: { readonly product: { readonly name: string } };
  } | null;
  readonly quote: {
    readonly id: string;
    readonly rfqId: string;
    readonly manufacturer: { readonly displayName: string };
  } | null;
  readonly order: {
    readonly id: string;
    readonly rfqId: string;
    readonly manufacturer: { readonly displayName: string };
    readonly rfq: { readonly package: { readonly product: { readonly name: string } } };
  } | null;
  readonly dispute: { readonly id: string; readonly orderId: string } | null;
};

/** What a thread is about, and where that thing lives. */
const contextOf = (
  thread: ThreadRow,
): { readonly label: string; readonly href: string | null } => {
  if (thread.order !== null) {
    return {
      label: `Order · ${thread.order.rfq.package.product.name}`,
      href: `/manufacturing/orders/${thread.order.id}`,
    };
  }
  if (thread.dispute !== null) {
    return {
      label: 'Dispute',
      href: `/manufacturing/orders/${thread.dispute.orderId}/dispute/${thread.dispute.id}`,
    };
  }
  if (thread.quote !== null) {
    return {
      label: `Quote · ${thread.quote.manufacturer.displayName}`,
      href: `/manufacturing/rfq/${thread.quote.rfqId}/quotes/${thread.quote.id}`,
    };
  }
  if (thread.rfq !== null) {
    return {
      label: `Request · ${thread.rfq.package.product.name}`,
      href: `/manufacturing/rfq/${thread.rfq.id}`,
    };
  }
  return { label: thread.contextKind, href: null };
};

const counterpartOf = (thread: ThreadRow, readerId: string): string => {
  const other = thread.participants.find((participant) => participant.userId !== readerId);
  if (other !== undefined) return other.user.displayName;
  return (
    thread.order?.manufacturer.displayName ??
    thread.quote?.manufacturer.displayName ??
    'IDEEZA'
  );
};

/**
 * The threads a buyer is in, newest first.
 *
 * A thread is only visible to its participants: nothing about a competing
 * manufacturer's conversation can be reached from here.
 */
export const listThreads = async (
  readerId: UserId,
): Promise<readonly ThreadSummary[]> => {
  const rows = await database().messageThread.findMany({
    where: { participants: { some: { userId: readerId } } },
    include: {
      ...threadInclude,
      messages: { orderBy: { sentAt: 'desc' }, take: 1 },
    },
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
  });

  return Promise.all(
    rows.map(async (row) => {
      const context = contextOf(row as unknown as ThreadRow);
      const me = row.participants.find((participant) => participant.userId === readerId);
      const unreadCount = await database().message.count({
        where: {
          threadId: row.id,
          authorId: { not: readerId },
          ...(me?.lastReadAt === null || me?.lastReadAt === undefined
            ? {}
            : { sentAt: { gt: me.lastReadAt } }),
        },
      });

      return {
        threadId: row.id,
        contextKind: row.contextKind,
        contextLabel: context.label,
        contextHref: context.href,
        counterpartName: counterpartOf(row as unknown as ThreadRow, readerId),
        lastMessageAt: row.lastMessageAt,
        lastMessagePreview: row.messages[0]?.body ?? null,
        unreadCount,
      };
    }),
  );
};

/**
 * The cards the design shows inside a conversation.
 *
 * A message may reference the domain event it is about, so the card is rendered
 * from the record rather than from text a party typed. Accepting or rejecting a
 * quote is not done here: those acts carry invariants and a confirmation, so the
 * card links to the screen that owns them.
 */
const cardFor = (
  kind: string,
  payload: Record<string, unknown>,
  context: { readonly rfqId: string | null; readonly orderId: string | null },
): ThreadEventCard | null => {
  const money = (value: unknown): string =>
    typeof value === 'number' ? (value / 100).toFixed(2) : '—';

  if (kind === 'quote.submitted') {
    const quoteId = typeof payload['quoteId'] === 'string' ? payload['quoteId'] : null;
    return {
      kind,
      title: 'Quote received',
      rows: [
        { label: 'Quantity', value: String(payload['quantity'] ?? '—') },
        { label: 'Unit price', value: money(payload['unitPriceMinor']) },
        { label: 'Total', value: money(payload['totalPriceMinor']) },
        { label: 'Lead time', value: `${String(payload['leadTimeDays'] ?? '—')} days` },
      ],
      actions:
        context.rfqId === null
          ? []
          : [
              {
                label: 'Review and decide',
                href:
                  quoteId === null
                    ? `/manufacturing/rfq/${context.rfqId}/quotes`
                    : `/manufacturing/rfq/${context.rfqId}/quotes/${quoteId}`,
              },
              {
                label: 'Compare quotes',
                href: `/manufacturing/rfq/${context.rfqId}/compare`,
              },
            ],
    };
  }

  if (kind === 'substitution.suggested') {
    return {
      kind,
      title: 'Replacement part suggested',
      rows: [
        { label: 'Part', value: String(payload['partReference'] ?? '—') },
        { label: 'Price impact', value: money(payload['priceImpactMinor']) },
      ],
      actions:
        context.rfqId === null
          ? []
          : [
              {
                label: 'Decide the replacement',
                href: `/manufacturing/rfq/${context.rfqId}/substitutions`,
              },
            ],
    };
  }

  if (kind === 'quote.accepted') {
    return {
      kind,
      title: 'Quote accepted',
      rows: [{ label: 'Next', value: 'The order opens awaiting payment' }],
      actions:
        context.orderId === null
          ? []
          : [{ label: 'Open the order', href: `/manufacturing/orders/${context.orderId}` }],
    };
  }

  if (kind === 'order.confirmed' || kind === 'payment.secured') {
    return {
      kind,
      title: 'Order confirmed',
      rows: [
        { label: 'Funds', value: 'Held by IDEEZA until delivery' },
        { label: 'Total', value: money(payload['totalChargedMinor']) },
      ],
      actions:
        context.orderId === null
          ? []
          : [
              {
                label: 'Track production',
                href: `/manufacturing/orders/${context.orderId}/progress`,
              },
            ],
    };
  }

  if (kind === 'order.shipped' || kind === 'order.delivered') {
    return {
      kind,
      title: kind === 'order.shipped' ? 'Shipped' : 'Delivered',
      rows: [{ label: 'Next', value: 'Confirm delivery, or raise an issue' }],
      actions:
        context.orderId === null
          ? []
          : [
              {
                label: 'Confirm delivery',
                href: `/manufacturing/orders/${context.orderId}/confirm-delivery`,
              },
            ],
    };
  }

  return null;
};

/** One conversation, and everything it is about. */
export const getThread = async (
  readerId: UserId,
  threadId: string,
): Promise<ThreadView | null> => {
  const thread = await database().messageThread.findFirst({
    where: { id: threadId, participants: { some: { userId: readerId } } },
    include: {
      ...threadInclude,
      messages: {
        orderBy: { sentAt: 'asc' },
        include: {
          author: { select: { id: true, displayName: true, role: true } },
          referencedEvent: true,
          attachments: { include: { file: { select: { name: true } } } },
        },
      },
    },
  });
  if (thread === null) return null;

  const row = thread as unknown as ThreadRow;
  const context = contextOf(row);
  const rfqId = thread.rfqId ?? thread.quote?.rfqId ?? thread.order?.rfqId ?? null;
  const orderId = thread.orderId ?? thread.dispute?.orderId ?? null;

  return {
    threadId: thread.id,
    contextKind: thread.contextKind,
    contextLabel: context.label,
    contextHref: context.href,
    counterpartName: counterpartOf(row, readerId),
    messages: thread.messages.map((message) => {
      const kind =
        message.referencedEvent === null
          ? null
          : toDomainEventKind(message.referencedEvent.kind);
      return {
        id: message.id,
        authorName: message.author?.displayName ?? 'IDEEZA',
        authorRole: message.author?.role ?? 'ops_admin',
        mine: message.authorId === readerId,
        body: message.body,
        sentAt: message.sentAt,
        card:
          kind === null
            ? null
            : cardFor(
                kind,
                (message.referencedEvent?.payload as Record<string, unknown> | null) ?? {},
                { rfqId, orderId },
              ),
        attachments: message.attachments.map((attachment) => attachment.file.name),
      };
    }),
    actions: [
      ...(rfqId === null
        ? []
        : [{ label: 'The request', href: `/manufacturing/rfq/${rfqId}` }]),
      ...(orderId === null
        ? []
        : [{ label: 'The order', href: `/manufacturing/orders/${orderId}` }]),
    ],
  };
};

/** Sends the buyer's message, and moves the thread to the top of the list. */
export const sendMessage = async (
  authorId: UserId,
  input: SendMessageInput,
  now: Date = new Date(),
): Promise<string> => {
  const thread = await database().messageThread.findFirst({
    where: { id: input.threadId, participants: { some: { userId: authorId } } },
    select: { id: true },
  });
  if (thread === null) throw new Error('That conversation does not exist.');

  const messageId = identifier('msg');
  await database().$transaction(async (transaction) => {
    await transaction.message.create({
      data: {
        id: messageId,
        threadId: thread.id,
        authorId,
        body: input.body,
        sentAt: now,
      },
    });
    await transaction.messageThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: now },
    });
    await transaction.messageThreadParticipant.update({
      where: { threadId_userId: { threadId: thread.id, userId: authorId } },
      data: { lastReadAt: now },
    });
  });

  return messageId;
};

/** Marks a thread as read up to now, which is what clears its unread badge. */
export const markThreadRead = async (
  readerId: UserId,
  threadId: string,
  now: Date = new Date(),
): Promise<void> => {
  await database()
    .messageThreadParticipant.update({
      where: { threadId_userId: { threadId, userId: readerId } },
      data: { lastReadAt: now },
    })
    .catch(() => undefined);
};

export const unreadMessageCount = async (readerId: UserId): Promise<number> => {
  const participations = await database().messageThreadParticipant.findMany({
    where: { userId: readerId },
    select: { threadId: true, lastReadAt: true },
  });

  const counts = await Promise.all(
    participations.map((participation) =>
      database().message.count({
        where: {
          threadId: participation.threadId,
          authorId: { not: readerId },
          ...(participation.lastReadAt === null
            ? {}
            : { sentAt: { gt: participation.lastReadAt } }),
        },
      }),
    ),
  );
  return counts.reduce((total, count) => total + count, 0);
};

/** The thread for one request or order, so a screen can link straight into it. */
export const threadForContext = async (
  readerId: UserId,
  context: { readonly rfqId?: RfqId; readonly orderId?: OrderId },
): Promise<string | null> => {
  const thread = await database().messageThread.findFirst({
    where: {
      participants: { some: { userId: readerId } },
      ...(context.rfqId === undefined ? {} : { rfqId: String(context.rfqId) }),
      ...(context.orderId === undefined ? {} : { orderId: String(context.orderId) }),
    },
    orderBy: { lastMessageAt: 'desc' },
    select: { id: true },
  });
  return thread?.id ?? null;
};

export const asUserId = (value: string): UserId => asId<UserId>(value);
