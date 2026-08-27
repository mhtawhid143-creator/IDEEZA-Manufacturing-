import { Card, PageHeader, Text } from '@ideeza/ui';
import { ThreadList } from '@/components/messages/thread-list.js';
import { listThreads } from '@/data/messaging.js';
import { requireBuyer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const when = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

/**
 * Messages: the conversations this buyer is part of.
 *
 * Threads are context-bound, so this is a list of things being discussed rather
 * than a list of people. Opening one is its own route, which keeps a conversation
 * linkable from a notification or from the order it belongs to.
 */
const MessagesPage = async () => {
  const actor = await requireBuyer('/messages');
  const threads = await listThreads(actor.userId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Messages"
        description="Every conversation belongs to a request, a quote, an order or a dispute."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card padded={false}>
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-heading">All conversations</p>
          </div>
          <ThreadList
            threads={threads.map((thread) => ({
              threadId: thread.threadId,
              counterpartName: thread.counterpartName,
              contextLabel: thread.contextLabel,
              when: when(thread.lastMessageAt),
              preview: thread.lastMessagePreview,
              unreadCount: thread.unreadCount,
            }))}
          />
        </Card>

        <Card>
          <p className="text-sm font-semibold text-heading">Pick a conversation</p>
          <Text tone="muted" size="sm" className="mt-1">
            Each thread carries the platform&rsquo;s own record of what happened —
            quotes received, replacements suggested, the order confirmed — alongside
            what was said.
          </Text>
        </Card>
      </div>
    </div>
  );
};

export default MessagesPage;
