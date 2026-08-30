import { notFound } from 'next/navigation';
import { Card, PageHeader } from '@ideeza/ui';
import { Conversation } from '@/components/messages/conversation.js';
import { ThreadList } from '@/components/messages/thread-list.js';
import { getThread, listThreads } from '@/data/messaging.js';
import { requireBuyer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const when = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

const moment = (value: Date): string =>
  `${value.toISOString().slice(0, 10)} · ${value.toISOString().slice(11, 16)} UTC`;

/** One conversation, with the thread list beside it as the design has it. */
const ThreadPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly threadId: string }>;
}) => {
  const { threadId } = await params;
  const actor = await requireBuyer('/messages');

  const [thread, threads] = await Promise.all([
    getThread(actor.userId, threadId),
    listThreads(actor.userId),
  ]);
  if (thread === null) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Messages"
        description={thread.contextLabel}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card padded={false} className="hidden lg:block">
          <div className="border-b border-border-subtle px-4 py-3">
            <p className="text-sm font-semibold text-text-primary">All conversations</p>
          </div>
          <ThreadList
            activeId={thread.threadId}
            threads={threads.map((row) => ({
              threadId: row.threadId,
              counterpartName: row.counterpartName,
              contextLabel: row.contextLabel,
              when: when(row.lastMessageAt),
              preview: row.lastMessagePreview,
              unreadCount: row.unreadCount,
            }))}
          />
        </Card>

        <Card padded={false}>
          <Conversation
            threadId={thread.threadId}
            counterpartName={thread.counterpartName}
            contextLabel={thread.contextLabel}
            contextHref={thread.contextHref}
            actions={thread.actions}
            messages={thread.messages.map((message) => ({
              id: message.id,
              authorName: message.authorName,
              authorRole: message.authorRole,
              mine: message.mine,
              body: message.body,
              when: moment(message.sentAt),
              card: message.card,
              attachments: message.attachments,
            }))}
          />
        </Card>
      </div>
    </div>
  );
};

export default ThreadPage;
