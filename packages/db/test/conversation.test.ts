import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  ensureRecordThread,
  postEventCard,
  promoteThreadToOrder,
} from '../src/conversation.js';
import { seedDatabase } from '../prisma/seed.js';
import { startTestDatabase, type TestDatabase } from '../test-support/index.js';

/**
 * How a conversation comes into existence.
 *
 * This lives in `packages/db` rather than in either panel because both write
 * it: the shop opens the conversation by quoting, the buyer continues it by
 * accepting and paying. Two copies of this would be two conversations, and the
 * one rule this platform will not break is that both sides read one record.
 *
 * The invariant with teeth is the participant list. An RFQ goes to several
 * shops and quotes are confidential, so there is a thread per shop on the same
 * request — never one thread per request with every shop in it.
 */
let database: TestDatabase;
let prisma: PrismaClient;

const RFQ = 'seed_rfq_1';
const SHOP_A = 'seed_mfr_a';
const SHOP_B = 'seed_mfr_b';

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  await seedDatabase(prisma);
});

afterAll(async () => {
  await database?.stop();
});

describe('opening the conversation about a record', () => {
  it('creates one thread for a shop, with the buyer and that shop in it', async () => {
    const threadId = await ensureRecordThread(prisma, {
      rfqId: RFQ,
      manufacturerId: SHOP_A,
    });
    expect(threadId).not.toBe('');

    const thread = await prisma.messageThread.findUnique({
      where: { id: threadId },
      include: { participants: true },
    });
    expect(thread?.contextKind).toBe('rfq');
    expect(thread?.rfqId).toBe(RFQ);

    const rfq = await prisma.rfq.findUnique({ where: { id: RFQ } });
    const members = await prisma.manufacturerMember.findMany({
      where: { manufacturerId: SHOP_A },
    });
    const ids = (thread?.participants ?? []).map((row) => row.userId).sort();
    expect(ids).toEqual([rfq?.buyerId, ...members.map((row) => row.userId)].sort());
  });

  it('is idempotent: quoting twice does not open a second conversation', async () => {
    const first = await ensureRecordThread(prisma, { rfqId: RFQ, manufacturerId: SHOP_A });
    const again = await ensureRecordThread(prisma, { rfqId: RFQ, manufacturerId: SHOP_A });
    expect(again).toBe(first);
  });

  it('gives a second shop on the same request its own conversation', async () => {
    const mine = await ensureRecordThread(prisma, { rfqId: RFQ, manufacturerId: SHOP_A });
    const theirs = await ensureRecordThread(prisma, { rfqId: RFQ, manufacturerId: SHOP_B });
    expect(theirs).not.toBe(mine);

    // And neither shop is in the other's thread, which is what keeps a quote
    // confidential — the participant list is the whole of that guarantee.
    const shopBMembers = await prisma.manufacturerMember.findMany({
      where: { manufacturerId: SHOP_B },
      select: { userId: true },
    });
    const inMine = await prisma.messageThreadParticipant.count({
      where: { threadId: mine, userId: { in: shopBMembers.map((row) => row.userId) } },
    });
    expect(inMine).toBe(0);
  });

  it('refuses a request that does not exist rather than orphaning a thread', async () => {
    await expect(
      ensureRecordThread(prisma, { rfqId: 'no_such_rfq', manufacturerId: SHOP_A }),
    ).rejects.toThrow();
    expect(await prisma.messageThread.count({ where: { rfqId: 'no_such_rfq' } })).toBe(0);
  });
});

describe('what the conversation says as the record moves', () => {
  it('posts a card that points at the event rather than repeating it', async () => {
    const threadId = await ensureRecordThread(prisma, { rfqId: RFQ, manufacturerId: SHOP_A });
    const event = await prisma.domainEvent.findFirst({ where: { subjectKind: 'quote' } });
    expect(event).not.toBeNull();
    if (event === null) return;

    const before = await prisma.messageThread.findUnique({ where: { id: threadId } });
    const at = new Date();
    await postEventCard(prisma, { threadId, eventId: event.id, at });

    const message = await prisma.message.findFirst({
      where: { threadId, referencedEventId: event.id },
    });
    // No body: the card is drawn from the event, so text here would be a second
    // copy of the facts that could disagree with the first.
    expect(message?.body).toBeNull();
    expect(message?.authorId).toBeNull();

    const after = await prisma.messageThread.findUnique({ where: { id: threadId } });
    expect(after?.lastMessageAt?.getTime()).toBe(at.getTime());
    expect(after?.lastMessageAt).not.toEqual(before?.lastMessageAt);
  });

  it('does not post the same event twice', async () => {
    const threadId = await ensureRecordThread(prisma, { rfqId: RFQ, manufacturerId: SHOP_A });
    const event = await prisma.domainEvent.findFirst({ where: { subjectKind: 'quote' } });
    if (event === null) return;

    await postEventCard(prisma, { threadId, eventId: event.id });
    expect(
      await prisma.message.count({ where: { threadId, referencedEventId: event.id } }),
    ).toBe(1);
  });
});

describe('the conversation carries on into the order', () => {
  it('keeps the thread and its history when the order opens', async () => {
    const threadId = await ensureRecordThread(prisma, { rfqId: RFQ, manufacturerId: SHOP_A });
    const said = await prisma.message.count({ where: { threadId } });
    expect(said).toBeGreaterThan(0);

    await promoteThreadToOrder(prisma, threadId, 'seed_order_1');

    const thread = await prisma.messageThread.findUnique({ where: { id: threadId } });
    expect(thread?.orderId).toBe('seed_order_1');
    expect(thread?.contextKind).toBe('order');
    // The request it grew out of is still on the thread: the conversation is
    // one thing, and the order screen and the request screen both link to it.
    expect(thread?.rfqId).toBe(RFQ);
    expect(await prisma.message.count({ where: { threadId } })).toBe(said);
  });
});
