'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Badge, Button, EmptyState, Icon, Text, useToast } from '@ideeza/ui';
import { markReadAction } from '@/app/(app)/notifications/actions.js';
import { goTo } from '@/lib/navigate.js';

export interface NotificationRow {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly deepLink: string | null;
  readonly read: boolean;
  readonly when: string;
}

/**
 * The shop's notification list.
 *
 * Each row is a record of something that happened and a way to the screen where
 * it can be acted on — a request routed here, a shortage the buyer answered, a
 * quote decided, a payout released. Opening one marks it read; nothing is ever
 * deleted, because a shop may need to show what it was told and when.
 */
export const NotificationList = ({
  notifications,
  filter,
  unreadCount,
}: {
  readonly notifications: readonly NotificationRow[];
  readonly filter: 'all' | 'unread';
  readonly unreadCount: number;
}) => {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();

  const open = (row: NotificationRow): void => {
    startTransition(async () => {
      if (!row.read) await markReadAction(row.id);
      if (row.deepLink !== null) {
        goTo(router, row.deepLink);
        return;
      }
      router.refresh();
    });
  };

  const markAll = (): void => {
    startTransition(async () => {
      const result = await markReadAction();
      push({
        title:
          result.marked === undefined || result.marked === 0
            ? 'Nothing to mark'
            : `${result.marked} marked as read`,
        body: 'They stay in the list; only their state changes.',
        tone: 'info',
      });
      router.refresh();
    });
  };

  if (notifications.length === 0) {
    return (
      <EmptyState
        title={filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}
        description={
          filter === 'unread'
            ? 'Everything the platform has told you has been read.'
            : 'IDEEZA tells you here when a request reaches your shop, a buyer answers a shortage or decides on a quote, an order needs you, or a payout is released.'
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={markAll} disabled={pending}>
            Mark all as read
          </Button>
        </div>
      )}

      <ul aria-label="Notifications" className="flex flex-col">
        {notifications.map((row) => (
          <li
            key={row.id}
            className="flex items-start gap-3 border-b border-border-subtle py-4 last:border-b-0"
          >
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-brand-subtle text-text-brand"
            >
              <Icon name="bell" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {row.deepLink === null ? (
                  <p className="text-sm font-semibold text-text-primary">{row.title}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => open(row)}
                    disabled={pending}
                    className="text-left text-sm font-semibold text-text-primary hover:text-text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                  >
                    {row.title}
                  </button>
                )}
                {!row.read && <Badge tone="brand">New</Badge>}
              </div>
              <Text size="sm" className="mt-0.5">
                {row.body}
              </Text>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Text tone="muted" size="xs">
                  {row.when}
                </Text>
                {row.deepLink !== null && (
                  <Link
                    href={row.deepLink}
                    className="text-xs font-medium text-text-brand underline hover:no-underline"
                    onClick={() => {
                      if (!row.read) void markReadAction(row.id);
                    }}
                  >
                    Open
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
