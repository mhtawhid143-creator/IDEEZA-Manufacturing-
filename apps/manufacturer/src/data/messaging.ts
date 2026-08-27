import { asId, type UserId } from '@ideeza/domain';
import { database } from '@/lib/db.js';

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface ThreadSummary {
  readonly threadId: string;
  readonly contextLabel: string;
  readonly contextHref: string | null;
  readonly counterpartName: string;
  readonly lastMessageAt: Date | null;
  readonly lastMessagePreview: string | null;
  readonly unreadCount: number;
}

export interface ThreadMessage {
  readonly id: string;
  readonly authorName: string;
  readonly mine: boolean;
  readonly body: string | null;
  readonly sentAt: Date;
  readonly attachments: readonly string[];
}

export interface ThreadFactCard {
  readonly title: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
  readonly actions: readonly { readonly label: string; readonly href: string }[];
}

export interface ThreadView {
  readonly threadId: string;
  readonly contextLabel: string;
  readonly contextHref: string | null;
  readonly counterpartName: string;
  readonly messages: readonly ThreadMessage[];
  /** The request or order this conversation is about, as facts. */
  readonly card: ThreadFactCard | null;
}

const threadInclude = {
  participants: {
    include: { user: { select: { id: true, displayName: true, role: true } } },
  },
  rfq: {
    select: {
      id: true,
      quantity: true,
      currency: true,
      targetPriceMinor: true,
      requestedServices: true,
      responseDeadline: true,
      package: {
        select: {
          kind: true,
          product: { select: { name: true } },
          _count: { select: { files: true } },
        },
      },
      _count: { select: { items: true } },
    },
  },
  quote: { select: { id: true, rfqId: true } },
  order: {
    select: {
      id: true,
      rfq: { select: { package: { select: { product: { select: { name: true } } } } } },
    },
  },
  dispute: { select: { id: true, orderId: true } },
} as const;

/**
 * What a thread is about, in the shop's words and pointing at the shop's screens.
 *
 * The same thread on the buyer's side says the same thing about the same record;
 * only the link differs, because the two panels have different screens for it.
 */
const contextOf = (row: {
  readonly contextKind: string;
  readonly rfqId: string | null;
  readonly quoteId: string | null;
  readonly orderId: string | null;
  readonly disputeId: string | null;
  readonly rfq: { readonly package: { readonly product: { readonly name: string } } } | null;
  readonly quote: { readonly id: string; readonly rfqId: string } | null;
  readonly order: {
    readonly id: string;
    readonly rfq: { readonly package: { readonly product: { readonly name: string } } };
  } | null;
  readonly dispute: { readonly id: string; readonly orderId: string } | null;
}): { readonly label: string; readonly href: string | null } => {
  if (row.order !== null) {
    return {
      label: `Order · ${row.order.rfq.package.product.name}`,
      href: `/orders/${row.order.id}`,
    };
  }
  if (row.dispute !== null) {
    return {
      label: 'Dispute case',
      href: `/orders/${row.dispute.orderId}/disputes/${row.dispute.id}`,
    };
  }
  if (row.quote !== null) {
    return { label: 'Quote', href: `/quotes/${row.quote.id}` };
  }
  if (row.rfq !== null && row.rfqId !== null) {
    return {
      label: `Request · ${row.rfq.package.product.name}`,
      href: `/rfqs/${row.rfqId}`,
    };
  }
  return { label: 'Conversation', href: null };
};

const counterpartOf = (
  row: {
    readonly participants: readonly {
      readonly userId: string;
      readonly user: { readonly displayName: string; readonly role: string };
    }[];
  },
  readerId: UserId,
): string =>
  row.participants.find((participant) => participant.userId !== readerId)?.user
    .displayName ?? 'IDEEZA';

/** Every conversation this member takes part in, newest first. */
export const listThreads = async (
  readerId: UserId,
): Promise<readonly ThreadSummary[]> => {
  const rows = await database().messageThread.findMany({
    where: { participants: { some: { userId: readerId } } },
    include: { ...threadInclude, messages: { orderBy: { sentAt: 'desc' }, take: 1 } },
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
  });

  return Promise.all(
    rows.map(async (row) => {
      const context = contextOf(row);
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
        contextLabel: context.label,
        contextHref: context.href,
        counterpartName: counterpartOf(row, readerId),
        lastMessageAt: row.lastMessageAt,
        lastMessagePreview: row.messages[0]?.body ?? null,
        unreadCount,
      };
    }),
  );
};

const major = (minor: bigint | null): string =>
  minor === null ? '—' : (Number(minor) / 100).toFixed(2);

const PACKAGE_LABEL: Readonly<Record<string, string>> = {
  pcb: 'PCB only',
  module_3d: '3D module',
  full_product: 'Full product',
};

/** One conversation, with the record it is about stated as facts. */
export const getThread = async (
  readerId: UserId,
  threadId: string,
): Promise<ThreadView | null> => {
  const row = await database().messageThread.findFirst({
    where: { id: threadId, participants: { some: { userId: readerId } } },
    include: {
      ...threadInclude,
      messages: {
        orderBy: { sentAt: 'asc' },
        include: {
          author: { select: { id: true, displayName: true, role: true } },
          attachments: { include: { file: { select: { name: true } } } },
        },
      },
    },
  });
  if (row === null) return null;

  const context = contextOf(row);

  const card: ThreadFactCard | null =
    row.rfq === null || row.rfqId === null
      ? null
      : {
          title: `Request ${row.rfqId.slice(-8).toUpperCase()} · ${row.rfq.package.product.name}`,
          rows: [
            {
              label: 'Package',
              value: PACKAGE_LABEL[row.rfq.package.kind] ?? row.rfq.package.kind,
            },
            { label: 'Quantity', value: `${row.rfq.quantity} units` },
            { label: 'BOM lines', value: String(row.rfq._count.items) },
            {
              label: 'Buyer’s target',
              value:
                row.rfq.targetPriceMinor === null
                  ? 'None given'
                  : `${row.rfq.currency} ${major(row.rfq.targetPriceMinor)}`,
            },
            { label: 'Attached files', value: String(row.rfq.package._count.files) },
            {
              label: 'Reply by',
              value:
                row.rfq.responseDeadline === null
                  ? 'No deadline'
                  : row.rfq.responseDeadline.toISOString().slice(0, 10),
            },
          ],
          actions: [
            { label: 'View request', href: `/rfqs/${row.rfqId}` },
            { label: 'Specification', href: `/rfqs/${row.rfqId}/specification` },
            { label: 'BOM / parts', href: `/rfqs/${row.rfqId}/bom` },
          ],
        };

  return {
    threadId: row.id,
    contextLabel: context.label,
    contextHref: context.href,
    counterpartName: counterpartOf(row, readerId),
    card,
    messages: row.messages.map((message) => ({
      id: message.id,
      authorName: message.author?.displayName ?? 'IDEEZA',
      mine: message.authorId === readerId,
      body: message.body,
      sentAt: message.sentAt,
      attachments: message.attachments.map((attachment) => attachment.file.name),
    })),
  };
};

export type MessageOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/** Sends a message into a thread this member takes part in. */
export const sendMessage = async (
  authorId: UserId,
  threadId: string,
  body: string,
  now: Date = new Date(),
): Promise<MessageOutcome> => {
  const thread = await database().messageThread.findFirst({
    where: { id: threadId, participants: { some: { userId: authorId } } },
    select: { id: true },
  });
  if (thread === null) {
    return { ok: false, message: 'That conversation is not yours.' };
  }
  if (body.trim() === '') return { ok: false, message: 'Write something first.' };

  await database().$transaction(async (transaction) => {
    await transaction.message.create({
      data: {
        id: identifier('msg'),
        threadId,
        authorId,
        body: body.trim(),
        sentAt: now,
      },
    });
    await transaction.messageThread.update({
      where: { id: threadId },
      data: { lastMessageAt: now },
    });
  });

  return { ok: true };
};

/** Marks everything in a thread as read for this member. */
export const markThreadRead = async (
  readerId: UserId,
  threadId: string,
  now: Date = new Date(),
): Promise<void> => {
  await database().messageThreadParticipant.updateMany({
    where: { threadId, userId: readerId },
    data: { lastReadAt: now },
  });
};

export const unreadMessageCount = async (readerId: UserId): Promise<number> => {
  const threads = await listThreads(readerId);
  return threads.reduce((total, thread) => total + thread.unreadCount, 0);
};

export const asUserId = (value: string): UserId => asId<UserId>(value);
