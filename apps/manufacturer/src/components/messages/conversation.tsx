'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  FormField,
  SearchInput,
  Text,
  Textarea,
  buttonAppearance,
  cn,
  useToast,
} from '@ideeza/ui';
import { markReadAction, sendMessageAction } from '@/app/(app)/messages/actions.js';

export interface ThreadRow {
  readonly threadId: string;
  readonly counterpartName: string;
  readonly contextLabel: string;
  readonly lastAt: string;
  readonly preview: string | null;
  readonly unreadCount: number;
}

export interface MessageRow {
  readonly id: string;
  readonly authorName: string;
  readonly mine: boolean;
  readonly body: string | null;
  readonly at: string;
  readonly attachments: readonly string[];
}

export interface FactCard {
  readonly title: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
  readonly actions: readonly { readonly label: string; readonly href: string }[];
}

export interface ConversationProps {
  readonly threads: readonly ThreadRow[];
  readonly activeId: string | null;
  readonly counterpartName: string;
  readonly contextLabel: string;
  readonly contextHref: string | null;
  readonly messages: readonly MessageRow[];
  readonly card: FactCard | null;
}

/**
 * Messages: the conversations attached to a request, a quote, an order or a case.
 *
 * There is no free-floating chat. Every thread hangs off a record, and the card
 * at the top of it is that record's facts — because a conversation about a
 * request that does not say which request is how commitments end up living only
 * in a chat.
 */
export const Conversation = ({
  threads,
  activeId,
  counterpartName,
  contextLabel,
  contextHref,
  messages,
  card,
}: ConversationProps) => {
  const [search, setSearch] = useState('');
  const [body, setBody] = useState('');
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const { push } = useToast();

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (activeId === null) return;
    void markReadAction(activeId);
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [activeId, messages.length]);

  const visible = threads.filter(
    (thread) =>
      search.trim() === '' ||
      thread.counterpartName.toLowerCase().includes(search.trim().toLowerCase()) ||
      thread.contextLabel.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const send = (): void => {
    if (activeId === null) return;
    startTransition(async () => {
      const result = await sendMessageAction(activeId, body);
      if (!result.sent) {
        push({
          title: 'That message was not sent',
          body: result.error ?? 'Try again.',
          tone: 'danger',
        });
        return;
      }
      setBody('');
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card padded={false} className="flex max-h-[70dvh] flex-col overflow-hidden">
        <div className="p-3">
          <FormField label="Search conversations" labelHidden>
            <SearchInput
              placeholder="Search…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </FormField>
        </div>
        {visible.length === 0 ? (
          <div className="p-4">
            <Text tone="muted" size="sm">
              No conversations match that.
            </Text>
          </div>
        ) : (
          <ul aria-label="Conversations" className="min-h-0 flex-1 overflow-y-auto">
            {visible.map((thread) => (
              <li key={thread.threadId} className="border-b border-border-subtle last:border-b-0">
                <Link
                  href={`/messages?thread=${thread.threadId}`}
                  className={cn(
                    'flex items-start gap-3 px-3 py-3 transition-colors hover:bg-bg-page focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
                    thread.threadId === activeId && 'bg-bg-brand-subtle',
                  )}
                >
                  <span
                    aria-hidden
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-brand text-xs font-semibold text-text-on-brand"
                  >
                    {thread.counterpartName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-text-primary">
                        {thread.counterpartName}
                      </span>
                      <span className="shrink-0 text-xs text-text-tertiary">{thread.lastAt}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-text-tertiary">
                      {thread.contextLabel}
                    </span>
                    {thread.preview !== null && (
                      <span className="mt-0.5 block truncate text-xs text-text-secondary">
                        {thread.preview}
                      </span>
                    )}
                  </span>
                  {thread.unreadCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-bg-brand px-1.5 text-2xs font-semibold text-text-on-brand">
                      {thread.unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padded={false} className="flex max-h-[70dvh] flex-col overflow-hidden">
        {activeId === null ? (
          <div className="p-6">
            <EmptyState
              title="Pick a conversation"
              description="Every conversation belongs to a request, a quote, an order or a case — there is no free-floating chat on this platform."
            />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-brand text-xs font-semibold text-text-on-brand"
                >
                  {counterpartName.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {counterpartName}
                  </p>
                  <Text tone="muted" size="xs">
                    {contextLabel}
                  </Text>
                </div>
              </div>
              {contextHref !== null && (
                <Link
                  href={contextHref}
                  className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                >
                  Open it
                </Link>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {card !== null && (
                <div className="mb-4 rounded-xl border border-border-subtle bg-bg-page p-3">
                  <p className="text-sm font-semibold text-text-primary">{card.title}</p>
                  <dl className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {card.rows.map((row) => (
                      <div key={row.label} className="flex items-baseline gap-2">
                        <dt className="text-xs text-text-tertiary">{row.label}:</dt>
                        <dd className="text-xs font-medium text-text-primary">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {card.actions.map((action) => (
                      <Link
                        key={action.href}
                        href={action.href}
                        className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {messages.length === 0 ? (
                <Text tone="muted" size="sm">
                  Nothing said yet.
                </Text>
              ) : (
                <ul aria-label="Messages" className="flex flex-col gap-3">
                  {messages.map((message) => (
                    <li
                      key={message.id}
                      className={cn(
                        'flex flex-col gap-1',
                        message.mine ? 'items-end' : 'items-start',
                      )}
                    >
                      <span className="text-xs text-text-tertiary">
                        {message.authorName} · {message.at}
                      </span>
                      <span
                        className={cn(
                          'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                          message.mine
                            ? 'bg-bg-brand text-text-on-brand'
                            : 'bg-bg-surface-raised text-text-secondary',
                        )}
                      >
                        {message.body ?? ''}
                      </span>
                      {message.attachments.length > 0 && (
                        <span className="text-xs text-text-tertiary">
                          {message.attachments.join(', ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div ref={bottom} />
            </div>

            <div className="border-t border-border-subtle p-3">
              <FormField label="Your message" labelHidden>
                <Textarea
                  rows={2}
                  placeholder="Type your message…"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </FormField>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <Text tone="muted" size="xs">
                  Anything you agree here still has to be recorded on the request, the
                  quote or the order to count.
                </Text>
                <Button
                  variant="primary"
                  size="sm"
                  loading={pending || !hydrated}
                  disabled={!hydrated}
                  onClick={send}
                >
                  Send
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <div className="lg:col-span-2">
        <Alert tone="info" title="No file attachments in this build">
          The design has an image and a paperclip on the composer. The platform records a
          file&rsquo;s name and hash rather than its bytes, so attaching one here would
          lose it — the files that matter travel with the request and the order instead.
        </Alert>
      </div>
    </div>
  );
};
