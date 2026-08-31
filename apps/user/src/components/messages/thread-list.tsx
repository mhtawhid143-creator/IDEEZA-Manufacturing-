import Link from 'next/link';
import { Avatar, Badge, EmptyState, Text, buttonAppearance, cn } from '@ideeza/ui';

export interface ThreadRow {
  readonly threadId: string;
  readonly counterpartName: string;
  readonly contextLabel: string;
  readonly when: string;
  readonly preview: string | null;
  readonly unreadCount: number;
}

/**
 * The conversation list from the design's left pane.
 *
 * Every thread names what it is about, because a thread on this platform is
 * always about something: a request, a quote, an order or a dispute. There is no
 * way to start a conversation out of nowhere, so there is no "new message"
 * button — a thread appears when a request goes out or an order opens.
 */
export const ThreadList = ({
  threads,
  activeId,
}: {
  readonly threads: readonly ThreadRow[];
  readonly activeId?: string | undefined;
}) => {
  if (threads.length === 0) {
    return (
      <EmptyState
        title="No conversations yet"
        description="A thread opens with the manufacturers when you send a request, and again on the order once a quote is accepted."
        action={
          <Link
            href="/manufacturing"
            className={buttonAppearance({ variant: 'secondary' })}
          >
            Go to manufacturing
          </Link>
        }
      />
    );
  }

  return (
    <ul aria-label="Conversations" className="flex flex-col">
      {threads.map((thread) => (
        <li key={thread.threadId}>
          <Link
            href={`/messages/${thread.threadId}`}
            aria-current={thread.threadId === activeId ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 border-b border-border-subtle px-4 py-3 transition-colors hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
              thread.threadId === activeId && 'bg-bg-brand-subtle',
            )}
          >
            <Avatar name={thread.counterpartName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary">
                {thread.counterpartName}
              </p>
              <Text tone="muted" size="xs" className="truncate">
                {thread.contextLabel}
              </Text>
              {thread.preview !== null && (
                <Text tone="muted" size="xs" className="truncate">
                  {thread.preview}
                </Text>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Text tone="muted" size="xs">
                {thread.when}
              </Text>
              {thread.unreadCount > 0 && <Badge tone="brand">{thread.unreadCount}</Badge>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
};
