import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type UserId } from '@ideeza/domain';
import type * as MessagingData from '../src/data/messaging.js';
import type * as NotificationData from '../src/data/notifications.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../packages/db/test-support/index.js';

let database: TestDatabase;
let prisma: PrismaClient;
let messaging: typeof MessagingData;
let notifications: typeof NotificationData;

const BUYER = asId<UserId>('seed_user_buyer');
const OTHER = asId<UserId>('seed_user_creator_a');
const MEMBER = 'seed_user_member_a';

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  messaging = await import('../src/data/messaging.js');
  notifications = await import('../src/data/notifications.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('conversations', () => {
  it('lists only the threads the reader takes part in', async () => {
    const mine = await messaging.listThreads(BUYER);
    expect(mine.length).toBeGreaterThan(0);
    expect(await messaging.listThreads(OTHER)).toHaveLength(0);
  });

  it('says what each thread is about, and where that lives', async () => {
    const threads = await messaging.listThreads(BUYER);
    const order = threads.find((thread) => thread.contextKind === 'order');
    const request = threads.find((thread) => thread.contextKind === 'rfq');

    expect(order?.contextLabel).toMatch(/^Order · /);
    expect(order?.contextHref).toMatch(/^\/manufacturing\/orders\//);
    expect(request?.contextLabel).toMatch(/^Request · /);
    expect(request?.contextHref).toMatch(/^\/manufacturing\/rfq\//);
  });

  it('counts what the other side said since the reader last looked', async () => {
    const threads = await messaging.listThreads(BUYER);
    const thread = threads.find((row) => row.unreadCount > 0);
    expect(thread).toBeDefined();

    await messaging.markThreadRead(BUYER, thread?.threadId ?? '');
    const after = await messaging.listThreads(BUYER);
    expect(after.find((row) => row.threadId === thread?.threadId)?.unreadCount).toBe(0);
  });

  it('does not count the reader’s own messages as unread', async () => {
    const threads = await messaging.listThreads(BUYER);
    const threadId = threads[0]?.threadId ?? '';
    await messaging.sendMessage(BUYER, { threadId, body: 'Any update on the boards?' });

    const after = await messaging.listThreads(BUYER);
    expect(after.find((row) => row.threadId === threadId)?.unreadCount).toBe(0);
    // Sending moves the thread to the top of the list.
    expect(after[0]?.threadId).toBe(threadId);
  });

  it('refuses to send into a thread the author is not in', async () => {
    const threads = await messaging.listThreads(BUYER);
    await expect(
      messaging.sendMessage(OTHER, {
        threadId: threads[0]?.threadId ?? '',
        body: 'Hello?',
      }),
    ).rejects.toThrow(/does not exist/);
  });

  it('renders a card from the recorded event, not from typed text', async () => {
    const threads = await messaging.listThreads(BUYER);
    const request = threads.find((thread) => thread.contextKind === 'rfq');
    const threadId = request?.threadId ?? '';

    // Events are append-only, so the card's event is written rather than edited.
    const event = await prisma.domainEvent.create({
      data: {
        id: 'evt_card_test',
        kind: 'quote_submitted',
        actorRole: 'manufacturer',
        actorManufacturerId: 'seed_mfr_a',
        subjectKind: 'quote',
        subjectId: 'seed_quote_a',
        payload: {
          quoteId: 'seed_quote_a',
          quantity: 500,
          unitPriceMinor: 790,
          totalPriceMinor: 395_000,
          leadTimeDays: 24,
        },
      },
    });
    await prisma.message.create({
      data: {
        id: 'msg_card_test',
        threadId,
        authorId: MEMBER,
        referencedEventId: event.id,
        sentAt: new Date(),
      },
    });

    const view = await messaging.getThread(BUYER, threadId);
    const card = view?.messages.find((message) => message.card !== null)?.card;
    expect(card?.title).toBe('Quote received');
    expect(card?.rows.map((row) => row.value)).toContain('7.90');
    expect(card?.actions[0]?.href).toMatch(/\/quotes\/seed_quote_a$/);
  });

  it('shows another buyer nothing of a thread', async () => {
    const threads = await messaging.listThreads(BUYER);
    expect(await messaging.getThread(OTHER, threads[0]?.threadId ?? '')).toBeNull();
  });

  it('finds the thread that belongs to one order', async () => {
    const threadId = await messaging.threadForContext(BUYER, {
      orderId: asId('seed_order_1'),
    });
    expect(threadId).not.toBeNull();
  });
});

describe('notifications', () => {
  it('lists them newest first, and counts the unread', async () => {
    await prisma.notification.create({
      data: {
        id: 'notice_new',
        recipientId: 'seed_user_buyer',
        kind: 'order.shipped',
        title: 'Shipped',
        body: 'The units have left the factory.',
        deepLink: '/manufacturing/orders/seed_order_1',
      },
    });

    const all = await notifications.listNotifications(BUYER);
    expect(all[0]?.id).toBe('notice_new');
    expect(await notifications.unreadNotificationCount(BUYER)).toBeGreaterThan(0);
  });

  it('filters to what has not been read', async () => {
    const unread = await notifications.listNotifications(BUYER, 'unread');
    expect(unread.every((row) => !row.read)).toBe(true);
  });

  it('marks one read without touching the others', async () => {
    const before = await notifications.unreadNotificationCount(BUYER);
    const marked = await notifications.markNotificationsRead(BUYER, ['notice_new']);
    expect(marked).toBe(1);
    expect(await notifications.unreadNotificationCount(BUYER)).toBe(before - 1);
  });

  it('marks everything read when nothing is named', async () => {
    await notifications.markNotificationsRead(BUYER, []);
    expect(await notifications.unreadNotificationCount(BUYER)).toBe(0);
  });

  it('never touches another reader’s notifications', async () => {
    await prisma.notification.create({
      data: {
        id: 'notice_other',
        recipientId: 'seed_user_creator_a',
        kind: 'order.shipped',
        title: 'Not yours',
        body: 'Belongs to someone else.',
      },
    });

    await notifications.markNotificationsRead(BUYER, ['notice_other']);
    const other = await prisma.notification.findUniqueOrThrow({
      where: { id: 'notice_other' },
    });
    expect(other.readAt).toBeNull();
  });
});
