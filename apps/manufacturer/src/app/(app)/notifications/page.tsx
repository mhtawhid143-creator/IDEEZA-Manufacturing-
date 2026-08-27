import { Card, PageHeader } from '@ideeza/ui';
import { HubTabs } from '@/components/hub-tabs.js';
import { NotificationList } from '@/components/notification-list.js';
import { listNotifications, unreadNotificationCount } from '@/data/notifications.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const moment = (value: Date): string =>
  `${value.toISOString().slice(0, 10)} · ${value.toISOString().slice(11, 16)} UTC`;

/**
 * Notifications, which the bell in the navbar has been counting all along.
 *
 * All and Unread are two routes rather than client state, for the same reason
 * the hub tabs are: a filtered list has to stay linkable from a message or from
 * somebody else's screenshot.
 */
const NotificationsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const actor = await requireManufacturer('/notifications');
  const query = await searchParams;
  const filter = query['filter'] === 'unread' ? 'unread' : 'all';

  const [notifications, unread] = await Promise.all([
    listNotifications(actor.userId, filter),
    unreadNotificationCount(actor.userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        description="What the platform has told you, newest first. Each one links to the screen where it can be acted on."
      />

      <Card padded={false}>
        <div className="border-b border-line px-4 py-3 md:px-6">
          <HubTabs
            label="Notification filters"
            items={[
              { id: 'all', label: 'All', href: '/notifications' },
              {
                id: 'unread',
                label: 'Unread',
                href: '/notifications?filter=unread',
                ...(unread === 0 ? {} : { count: unread }),
              },
            ]}
            activeId={filter}
          />
        </div>
        <div className="p-4 md:p-6">
          <NotificationList
            filter={filter}
            unreadCount={unread}
            notifications={notifications.map((row) => ({
              id: row.id,
              kind: row.kind,
              title: row.title,
              body: row.body,
              deepLink: row.deepLink,
              read: row.read,
              when: moment(row.createdAt),
            }))}
          />
        </div>
      </Card>
    </div>
  );
};

export default NotificationsPage;
