import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type ManufacturerId, type UserId } from '@ideeza/domain';
import type * as ShopMessaging from '../src/data/messaging.js';
import type * as BuyerMessaging from '../../user/src/data/messaging.js';
import type * as ShopQuotes from '../src/data/quotes.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

/**
 * The conversation is born from the record, and both sides read the same one.
 *
 * Before this, a thread only ever existed because the seed had written one: a
 * shop could quote a real request and the buyer had nowhere to answer. What is
 * pinned here is the whole of the fix — that quoting opens the conversation,
 * that the card in it is drawn from the recorded event rather than from typed
 * text, and that the two panels tell the same event with the same numbers.
 */
let database: TestDatabase;
let prisma: PrismaClient;
let shop: typeof ShopMessaging;
let buyer: typeof BuyerMessaging;
let quotes: typeof ShopQuotes;

/** The shop whose quote the buyer accepted: it owns the seeded order. */
const SHOP = asId<ManufacturerId>('seed_mfr_a');
/** A shop whose quote is still on the table, so it can still be revised. */
const OPEN_SHOP = asId<ManufacturerId>('seed_mfr_b');
const BUYER = asId<UserId>('seed_user_buyer');
let member = asId<UserId>('seed_user_member_a');
let openMember = asId<UserId>('seed_user_member_b');
/** The thread the quote in the first test opens, read by the ones after it. */
let opened = '';

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  shop = await import('../src/data/messaging.js');
  buyer = await import('../../user/src/data/messaging.js');
  quotes = await import('../src/data/quotes.js');

  const membership = await prisma.manufacturerMember.findFirst({
    where: { manufacturerId: SHOP },
  });
  member = asId<UserId>(membership?.userId ?? 'seed_user_member_a');
  const other = await prisma.manufacturerMember.findFirst({
    where: { manufacturerId: OPEN_SHOP },
  });
  openMember = asId<UserId>(other?.userId ?? 'seed_user_member_b');
});

afterAll(async () => {
  await database?.stop();
});

describe('quoting opens the conversation', () => {
  it('creates the thread, and puts the quote in it as a card', async () => {
    const quote = await prisma.quote.findFirst({
      where: { manufacturerId: OPEN_SHOP, order: null },
      orderBy: { version: 'desc' },
    });
    expect(quote).not.toBeNull();
    if (quote === null) return;
    const rfqId = quote.rfqId;

    // The seed's only request is a finished one: closed, past its deadline, and
    // already answered by both shops. Quoting is refused in every one of those
    // states, and rightly so — so the state a live request is actually in is
    // arranged here. This file boots its own database, so nothing outside it
    // sees any of it.
    await prisma.rfq.update({
      where: { id: rfqId },
      data: {
        status: 'submitted',
        closedAt: null,
        responseDeadline: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    await prisma.rfqRecipient.updateMany({
      where: { rfqId, manufacturerId: OPEN_SHOP },
      data: { status: 'routed', quotedAt: null },
    });
    await prisma.quote.update({ where: { id: quote.id }, data: { status: 'draft' } });

    // And every conversation it already has is cleared, so what is proved is
    // that the act opens one — not that the seed had.
    await prisma.messageThread.deleteMany({ where: { rfqId } });
    expect(await prisma.messageThread.count({ where: { rfqId } })).toBe(0);

    const result = await quotes.submitQuote(OPEN_SHOP, asId(rfqId), {
      unitPriceMinor: 4_200,
      leadTimeDays: 21,
      expiresAt: new Date(Date.now() + 14 * 86_400_000),
      materialProcessNotes: 'FR-4 1.6mm, ENIG, class 2 workmanship throughout.',
      terms: '50% on order, 50% before shipping.',
    });
    expect(result.ok ? 'ok' : (result as { message?: string }).message).toBe('ok');
    if (!result.ok) return;

    const threads = await prisma.messageThread.findMany({
      where: { rfqId },
      orderBy: { createdAt: 'desc' },
    });
    expect(threads.length).toBe(1);
    opened = threads[0]?.id ?? '';

    // The card is a message that points at the event and carries no words of
    // its own — so the price on it cannot drift from the price in the record.
    const card = await prisma.message.findFirst({
      where: { threadId: opened },
      include: { referencedEvent: true },
    });
    expect(card?.body).toBeNull();
    expect(card?.referencedEvent?.kind).toBe('quote_submitted');
  });

  it('is the same conversation for the shop and for the buyer', async () => {
    expect(opened).not.toBe('');
    if (opened === '') return;

    const thread = await prisma.messageThread.findUnique({
      where: { id: opened },
      include: { rfq: { select: { buyerId: true } } },
    });
    if (thread === null) return;

    const fromShop = await shop.getThread(openMember, opened);
    // Read as the buyer this request actually belongs to, not as a constant:
    // the participants are what make the thread readable, and the buyer on the
    // record is the one `ensureRecordThread` put in it.
    const fromBuyer = await buyer.getThread(
      asId<UserId>(thread.rfq?.buyerId ?? BUYER),
      opened,
    );
    expect(fromShop).not.toBeNull();
    expect(fromBuyer).not.toBeNull();
    if (fromShop === null || fromBuyer === null) return;

    // One row of messages, read twice.
    expect(fromShop.messages.length).toBe(fromBuyer.messages.length);

    const shopCard = fromShop.messages.find((message) => message.card !== null);
    const buyerCard = fromBuyer.messages.find((message) => message.card !== null);
    expect(shopCard).toBeDefined();
    expect(buyerCard).toBeDefined();
    // Different words for different readers — "You sent the quote" against
    // "Quote received" — and the same numbers underneath both.
    expect(shopCard?.card?.title).not.toBe(buyerCard?.card?.title);
    const total = (rows: readonly { readonly label: string; readonly value: string }[]) =>
      rows.find((row) => row.label === 'Total')?.value;
    expect(total(shopCard?.card?.rows ?? [])).toBe(total(buyerCard?.card?.rows ?? []));
  });

  it('does not let a shop read another shop’s conversation', async () => {
    if (opened === '') return;
    const otherShopMember = await prisma.manufacturerMember.findFirst({
      where: { manufacturerId: { not: OPEN_SHOP } },
    });
    if (otherShopMember === null) return;

    expect(await shop.getThread(asId<UserId>(otherShopMember.userId), opened)).toBeNull();
  });
});

describe('the record card at the top of the conversation', () => {
  it('shows the order once there is one, not the request it grew out of', async () => {
    const orderThread = await prisma.messageThread.findFirst({
      where: { orderId: { not: null } },
    });
    expect(orderThread).not.toBeNull();
    if (orderThread === null) return;

    const view = await shop.getThread(member, orderThread.id);
    // The old behaviour: an order thread had no rfq, so this was null and the
    // conversation opened with nothing at the top of it.
    expect(view?.card).not.toBeNull();
    expect(view?.card?.title.startsWith('Order ')).toBe(true);
    expect(view?.card?.actions.some((action) => action.label === 'Open the order')).toBe(true);
  });
});
