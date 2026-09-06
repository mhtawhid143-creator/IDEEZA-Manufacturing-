import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * How a conversation about a record comes into existence, and how it moves.
 *
 * This lives here rather than in either panel because both panels write it: the
 * shop opens the conversation by quoting, and the buyer carries it on by
 * accepting and paying. Two copies of these three functions would drift into
 * two conversations, and the one rule this platform does not break is that both
 * sides read the same record.
 *
 * Everything takes a client so a caller can pass its transaction: a card about
 * an event belongs to the same business act that recorded the event, and a
 * conversation that exists while the quote it announces was rolled back is a
 * conversation about nothing.
 */

/** A Prisma client or the transaction handle inside `$transaction`. */
export type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface RecordThreadKey {
  readonly rfqId: string;
  readonly manufacturerId: string;
}

/**
 * The conversation between one buyer and one shop about one request.
 *
 * There is a thread per shop on the same request, never one thread per request
 * with every shop in it. A request goes out to several shops and their quotes
 * are confidential from each other, so the participant list is the whole of
 * that guarantee — put two shops in one thread and the confidentiality is gone
 * with no other check standing between them.
 *
 * Idempotent by that same participant list rather than by a composite key,
 * because the participants are what actually identify the thread: quoting twice,
 * or quoting and then suggesting a part, must land in the conversation that is
 * already open.
 */
export const ensureRecordThread = async (
  client: DatabaseClient,
  key: RecordThreadKey,
): Promise<string> => {
  const rfq = await client.rfq.findUnique({
    where: { id: key.rfqId },
    select: { id: true, buyerId: true },
  });
  if (rfq === null) {
    // Thrown rather than returned: a caller reaching this has already decided
    // the request exists, so this is a programming fault and not a refusal to
    // show somebody.
    throw new Error(`no request ${key.rfqId} to open a conversation about`);
  }

  const members = await client.manufacturerMember.findMany({
    where: { manufacturerId: key.manufacturerId },
    select: { userId: true },
  });
  const memberIds = members.map((member) => member.userId);
  if (memberIds.length === 0) {
    throw new Error(`shop ${key.manufacturerId} has nobody to talk to`);
  }

  const existing = await client.messageThread.findFirst({
    where: {
      rfqId: key.rfqId,
      participants: { some: { userId: { in: memberIds } } },
    },
    select: { id: true },
  });
  if (existing !== null) return existing.id;

  const threadId = identifier('thr');
  await client.messageThread.create({
    data: {
      id: threadId,
      contextKind: 'rfq',
      rfqId: key.rfqId,
      participants: {
        create: [rfq.buyerId, ...memberIds].map((userId) => ({ userId })),
      },
    },
  });
  return threadId;
};

/**
 * The conversation follows the record into the order rather than restarting.
 *
 * The request thread becomes the order thread: same room, same history. What
 * was agreed while the quote was on the table is the context for the order, and
 * making somebody open a second conversation to find it is how a platform loses
 * the thread of its own job. `rfqId` stays set, so the request screen and the
 * order screen both point at this one conversation.
 */
export const promoteThreadToOrder = async (
  client: DatabaseClient,
  threadId: string,
  orderId: string,
): Promise<void> => {
  await client.messageThread.update({
    where: { id: threadId },
    data: { contextKind: 'order', orderId },
  });
};

export interface EventCard {
  readonly threadId: string;
  readonly eventId: string;
  readonly at?: Date;
}

/**
 * Announces a recorded event in the conversation.
 *
 * The message carries no words of its own. It points at the `DomainEvent`, and
 * each panel draws the card from that event in its own reader's language — so
 * the price on the card is the price in the record, and cannot drift from it or
 * disagree between the two sides.
 *
 * Posting the same event twice is a no-op rather than an error: a caller that
 * retries a business act should not litter the conversation with duplicates.
 */
export const postEventCard = async (
  client: DatabaseClient,
  card: EventCard,
): Promise<void> => {
  const already = await client.message.findFirst({
    where: { threadId: card.threadId, referencedEventId: card.eventId },
    select: { id: true },
  });
  if (already !== null) return;

  const at = card.at ?? new Date();
  await client.message.create({
    data: {
      id: identifier('msg'),
      threadId: card.threadId,
      // Nobody typed it: the platform is reporting what happened, and an author
      // here would put a person's name on a fact the record produced.
      authorId: null,
      body: null,
      referencedEventId: card.eventId,
      sentAt: at,
    },
  });
  await client.messageThread.update({
    where: { id: card.threadId },
    data: { lastMessageAt: at },
  });
};
