import { PageHeader } from '@ideeza/ui';
import { Conversation } from '@/components/messages/conversation.js';
import { getThread, listThreads } from '@/data/messaging.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const when = (value: Date | null): string => {
  if (value === null) return '';
  const today = new Date().toISOString().slice(0, 10);
  const day = value.toISOString().slice(0, 10);
  return day === today ? value.toISOString().slice(11, 16) : day;
};

/**
 * Messages: every conversation this member takes part in.
 *
 * The thread is chosen through the address bar rather than client state, so a
 * conversation can be linked to from a request, an order or a notification and
 * the back button behaves.
 */
const MessagesPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const actor = await requireManufacturer('/messages');
  const query = await searchParams;
  const raw = query['thread'];
  const requested = Array.isArray(raw) ? raw[0] : raw;

  const threads = await listThreads(actor.userId);
  const activeId = requested ?? threads[0]?.threadId ?? null;
  const thread = activeId === null ? null : await getThread(actor.userId, activeId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Messages"
        description="Conversations about a request, a quote, an order or a case."
      />

      <Conversation
        threads={threads.map((row) => ({
          threadId: row.threadId,
          counterpartName: row.counterpartName,
          contextLabel: row.contextLabel,
          lastAt: when(row.lastMessageAt),
          preview: row.lastMessagePreview,
          unreadCount: row.unreadCount,
        }))}
        activeId={thread?.threadId ?? null}
        counterpartName={thread?.counterpartName ?? ''}
        contextLabel={thread?.contextLabel ?? ''}
        contextHref={thread?.contextHref ?? null}
        card={thread?.card ?? null}
        messages={(thread?.messages ?? []).map((message) => ({
          id: message.id,
          authorName: message.authorName,
          mine: message.mine,
          body: message.body,
          at: `${message.sentAt.toISOString().slice(0, 10)} ${message.sentAt
            .toISOString()
            .slice(11, 16)}`,
          attachments: message.attachments,
        }))}
      />
    </div>
  );
};

export default MessagesPage;
