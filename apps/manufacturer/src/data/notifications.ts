import type { UserId } from '@ideeza/domain';
import { database } from '@/lib/db.js';

export interface NotificationView {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly deepLink: string | null;
  readonly read: boolean;
  readonly createdAt: Date;
}

/**
 * What the platform has told this shop member.
 *
 * A notification belongs to the member, not to the shop: two agents in one shop
 * do not clear each other's unread counts, which is the same rule the message
 * threads follow.
 *
 * It is a record of something that already happened, so it is never where a
 * decision is made — it carries a link to the screen that owns the decision.
 * Reading one changes nothing but its own state, and nothing is ever deleted.
 */
export const listNotifications = async (
  recipientId: UserId,
  filter: 'all' | 'unread' = 'all',
): Promise<readonly NotificationView[]> => {
  const rows = await database().notification.findMany({
    where: {
      recipientId,
      ...(filter === 'unread' ? { readAt: null } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    deepLink: row.deepLink,
    read: row.readAt !== null,
    createdAt: row.createdAt,
  }));
};

export const unreadNotificationCount = async (recipientId: UserId): Promise<number> =>
  database().notification.count({ where: { recipientId, readAt: null } });

/** Marks the given notifications read, or every unread one when none are named. */
export const markNotificationsRead = async (
  recipientId: UserId,
  notificationIds: readonly string[],
  now: Date = new Date(),
): Promise<number> => {
  const result = await database().notification.updateMany({
    where: {
      recipientId,
      readAt: null,
      ...(notificationIds.length === 0 ? {} : { id: { in: [...notificationIds] } }),
    },
    data: { readAt: now },
  });
  return result.count;
};
