import {asId, type UserId, majorAmount, counted } from '@ideeza/domain';
import { toDomainEventKind } from '@ideeza/db';
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
  /**
   * What the platform is reporting, when this message reports something.
   *
   * A message either carries a person's words or points at a recorded event.
   * Never both: the card is drawn from the event, so words beside it would be a
   * second copy of the same facts, free to disagree with the first.
   */
  readonly card: EventCardView | null;
}

/** A recorded event, told in the shop's words and pointing at the shop's screens. */
export interface EventCardView {
  readonly kind: string;
  readonly title: string;
  readonly tone: 'neutral' | 'brand' | 'success';
  readonly rows: readonly { readonly label: string; readonly value: string }[];
  readonly actions: readonly { readonly label: string; readonly href: string }[];
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
      rfqId: true,
      status: true,
      snapshot: {
        select: {
          currency: true,
          totalPriceMinor: true,
          // UIUX-231: an order that carries substitutions has to be able to say
          // so, and to point at where they can be read.
          approvedSubstitutionIds: true,
        },
      },
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

/**
 * What the thread list shows for a card, which has no words of its own.
 *
 * Without this, every conversation whose latest entry is an event — which is
 * most of them, since the platform speaks more often than the two sides do —
 * showed a blank line where the preview goes.
 */
const EVENT_PREVIEW: Readonly<Record<string, string>> = {
  quote_submitted: 'You sent a quote',
  quote_revised: 'You revised the quote',
  quote_withdrawn: 'You withdrew the quote',
  substitution_suggested: 'You suggested a replacement part',
  substitution_unavailable: 'You said a part cannot be supplied',
  quote_accepted: 'The buyer accepted your quote',
  order_confirmed: 'The money is held — you can start',
  payment_secured: 'The money is held — you can start',
};

/** Every conversation this member takes part in, newest first. */
export const listThreads = async (
  readerId: UserId,
): Promise<readonly ThreadSummary[]> => {
  const rows = await database().messageThread.findMany({
    where: { participants: { some: { userId: readerId } } },
    include: {
      ...threadInclude,
      messages: {
        orderBy: { sentAt: 'desc' },
        take: 1,
        include: { referencedEvent: { select: { kind: true } } },
      },
    },
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
        lastMessagePreview:
          row.messages[0]?.body ??
          EVENT_PREVIEW[row.messages[0]?.referencedEvent?.kind ?? ''] ??
          null,
        unreadCount,
      };
    }),
  );
};

/**
 * The cards the design puts inside a conversation, from this side of it.
 *
 * The buyer's panel draws the same events with the same numbers; only the words
 * and the links differ, because the two panels have different screens and the
 * two readers did different things. "Quote received" over there is "You sent
 * the quote" here — one event, two honest accounts of it.
 *
 * Nothing is decided from a card. Accepting, revising and paying carry
 * invariants and a confirmation, so a card links to the screen that owns the
 * act rather than performing it in a chat.
 */
const cardFor = (
  kind: string,
  payload: Record<string, unknown>,
  context: { readonly rfqId: string | null; readonly orderId: string | null },
): EventCardView | null => {
  const money = (value: unknown): string =>
    typeof value === 'number' ? majorAmount(value) : '—';
  const count = (value: unknown): string =>
    typeof value === 'number' ? String(value) : '—';

  const quoteHref =
    typeof payload['quoteId'] === 'string'
      ? `/quotes/${payload['quoteId']}`
      : context.rfqId === null
        ? null
        : `/rfqs/${context.rfqId}`;

  if (kind === 'quote.submitted' || kind === 'quote.revised') {
    return {
      kind,
      title: kind === 'quote.submitted' ? 'You sent the quote' : 'You revised the quote',
      tone: 'brand',
      rows: [
        { label: 'Quantity', value: count(payload['quantity']) },
        { label: 'Unit price', value: money(payload['unitPriceMinor']) },
        { label: 'Total', value: money(payload['totalPriceMinor']) },
        {
          label: 'Lead time',
          value:
            typeof payload['leadTimeDays'] === 'number'
              ? `${String(payload['leadTimeDays'])} days`
              : '—',
        },
      ],
      actions: quoteHref === null ? [] : [{ label: 'Open the quote', href: quoteHref }],
    };
  }

  if (kind === 'quote.withdrawn') {
    return {
      kind,
      title: 'You withdrew the quote',
      tone: 'neutral',
      rows: [{ label: 'Now', value: 'The buyer can no longer accept these terms' }],
      actions:
        context.rfqId === null
          ? []
          : [{ label: 'The request', href: `/rfqs/${context.rfqId}` }],
    };
  }

  if (kind === 'substitution.suggested') {
    return {
      kind,
      title: 'You suggested a replacement part',
      tone: 'neutral',
      rows: [
        { label: 'Asked for', value: String(payload['reference'] ?? '—') },
        { label: 'You offered', value: String(payload['suggestedPartName'] ?? '—') },
        { label: 'Price impact', value: money(payload['priceImpactMinor']) },
      ],
      actions:
        context.rfqId === null
          ? []
          : [{ label: 'The parts on this request', href: `/rfqs/${context.rfqId}/bom` }],
    };
  }

  if (kind === 'substitution.unavailable') {
    return {
      kind,
      title: 'You said a part cannot be supplied',
      tone: 'neutral',
      rows: [
        { label: 'Asked for', value: String(payload['reference'] ?? '—') },
        { label: 'Your reason', value: String(payload['reason'] ?? '—') },
      ],
      actions:
        context.rfqId === null
          ? []
          : [{ label: 'The parts on this request', href: `/rfqs/${context.rfqId}/bom` }],
    };
  }

  if (kind === 'quote.accepted') {
    return {
      kind,
      title: 'The buyer accepted your quote',
      tone: 'success',
      rows: [
        { label: 'Next', value: 'IDEEZA secures the payment before the order opens' },
        { label: 'Build now?', value: 'No — wait for the order' },
      ],
      actions: quoteHref === null ? [] : [{ label: 'The quote they took', href: quoteHref }],
    };
  }

  if (kind === 'order.confirmed' || kind === 'payment.secured') {
    return {
      kind,
      title: 'The money is held — you can start',
      tone: 'success',
      rows: [
        { label: 'Held by IDEEZA', value: money(payload['totalChargedMinor']) },
        { label: 'Released on', value: 'Delivery the buyer confirms' },
      ],
      actions:
        context.orderId === null
          ? []
          : [{ label: 'Open the order', href: `/orders/${context.orderId}` }],
    };
  }

  return null;
};

const major = (minor: bigint | null): string =>
  minor === null ? '—' : majorAmount(Number(minor));

// What the package holds, said with the one name for each kind of work
// (UIUX-144) rather than a second set of words for the same three things.
const PACKAGE_LABEL: Readonly<Record<string, string>> = {
  pcb: 'PCB only',
  module_3d: '3D printing only',
  full_product: 'PCB + 3D printing',
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
          referencedEvent: true,
          attachments: { include: { file: { select: { name: true } } } },
        },
      },
    },
  });
  if (row === null) return null;

  const context = contextOf(row);
  // A conversation that has been promoted carries both: it began on the request
  // and it is now about the order, and a card may need to point at either.
  const rfqId = row.rfqId ?? row.quote?.rfqId ?? row.order?.rfqId ?? null;
  const orderId = row.orderId ?? row.dispute?.orderId ?? null;

  /**
   * The record this conversation is about, at the top of it.
   *
   * An order takes precedence over the request it grew out of: once the job is
   * running, what a shop needs in front of it is the order and its money, not
   * the deadline for a quote it has already sent. Before that, the request. A
   * conversation with neither says so rather than opening with a blank frame.
   */
  const orderCard: ThreadFactCard | null =
    row.order === null
      ? null
      : {
          title: `Order ${row.order.id.slice(-8).toUpperCase()} · ${row.order.rfq.package.product.name}`,
          rows: [
            { label: 'State', value: row.order.status.replace(/_/g, ' ') },
            {
              label: 'Agreed value',
              value:
                row.order.snapshot === null
                  ? '—'
                  : `${row.order.snapshot.currency} ${major(row.order.snapshot.totalPriceMinor)}`,
            },
            ...(row.rfq === null
              ? []
              : [{ label: 'Quantity', value: counted(row.rfq.quantity, 'unit') }]),
            /*
             * UIUX-231: a substitution that travels with a live order is the
             * thing most expensive to discover late, so the card names it
             * rather than leaving it to be found on a tab.
             */
            ...((row.order.snapshot?.approvedSubstitutionIds.length ?? 0) === 0
              ? []
              : [
                  {
                    label: 'Substitutions',
                    value: `${row.order.snapshot?.approvedSubstitutionIds.length} approved, built into these terms`,
                  },
                ]),
          ],
          /*
           * One action per destination (UIUX-230). "Open the order" and
           * "Production stages" both pointed at the same screen, which is two
           * buttons for one place and no way to tell them apart.
           */
          actions: [
            { label: 'Open the order', href: `/orders/${row.order.id}` },
            ...((row.order.snapshot?.approvedSubstitutionIds.length ?? 0) === 0
              ? []
              : [
                  {
                    label: 'The substitutions it was accepted with',
                    href: `/orders/${row.order.id}/quote`,
                  },
                ]),
            ...(rfqId === null
              ? []
              : [{ label: 'The original request', href: `/rfqs/${rfqId}` }]),
          ],
        };

  const requestCard: ThreadFactCard | null =
    row.rfq === null || row.rfqId === null
      ? null
      : {
          title: `Request ${row.rfqId.slice(-8).toUpperCase()} · ${row.rfq.package.product.name}`,
          rows: [
            {
              label: 'Package',
              value: PACKAGE_LABEL[row.rfq.package.kind] ?? row.rfq.package.kind,
            },
            { label: 'Quantity', value: counted(row.rfq.quantity, 'unit') },
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
          /*
           * The request itself is not repeated here (UIUX-230): the thread
           * header already links to it by name and stays put as the reader
           * scrolls, so a second link to the same screen earns nothing. What is
           * left are the two places the header cannot reach.
           */
          actions: [
            { label: 'Specification', href: `/rfqs/${row.rfqId}/specification` },
            { label: 'BOM / parts', href: `/rfqs/${row.rfqId}/bom` },
          ],
        };

  const card = orderCard ?? requestCard;

  return {
    threadId: row.id,
    contextLabel: context.label,
    contextHref: context.href,
    counterpartName: counterpartOf(row, readerId),
    card,
    messages: row.messages.map((message) => {
      const kind =
        message.referencedEvent === null
          ? null
          : toDomainEventKind(message.referencedEvent.kind);
      return {
        id: message.id,
        // A card is the platform reporting, so it is nobody's message. The
        // author falls back to IDEEZA for the few rows that predate this.
        authorName: message.author?.displayName ?? 'IDEEZA',
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
