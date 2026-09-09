'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  Button,
  Card,
  EmptyState,
  FormField,
  Icon,
  SearchInput,
  Text,
  Textarea,
  buttonAppearance,
  cn,
  useToast,
  type IconName,
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
  /** The day it was said, for the separators between them. */
  readonly on: string;
  readonly attachments: readonly string[];
  /** Set when the platform is reporting an event rather than a person talking. */
  readonly card: EventCard | null;
}

export interface EventCard {
  readonly kind: string;
  readonly title: string;
  readonly tone: 'neutral' | 'brand' | 'success';
  readonly rows: readonly { readonly label: string; readonly value: string }[];
  readonly actions: readonly { readonly label: string; readonly href: string }[];
}

/**
 * An event card is the platform speaking, so it is neither side's bubble: it
 * runs the width of the column, and its icon says which kind of thing happened
 * without the reader having to parse the title first.
 */
const CARD_ICON: Readonly<Record<string, IconName>> = {
  'quote.submitted': 'send',
  'quote.revised': 'send',
  'quote.withdrawn': 'close',
  'substitution.suggested': 'parts',
  'substitution.unavailable': 'alert',
  'quote.accepted': 'check',
  'order.confirmed': 'payouts',
  'payment.secured': 'payouts',
};

const CARD_TONE: Readonly<Record<EventCard['tone'], string>> = {
  neutral: 'bg-bg-subtle text-icon-secondary',
  brand: 'bg-bg-brand-subtle text-icon-brand',
  success: 'bg-bg-success-subtle text-icon-success',
};

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
              {contextHref !== null && card === null && (
                <Link
                  href={contextHref}
                  className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                >
                  Open the record
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
                  Nothing said yet. What happens to this record will appear here as it
                  happens, and anything you type goes to the buyer.
                </Text>
              ) : (
                <ul aria-label="Messages" className="flex flex-col gap-4">
                  {messages.map((message, index) => {
                    // A new day gets a separator: without one, a conversation that
                    // ran over three weeks reads as one afternoon.
                    const newDay = message.on !== messages[index - 1]?.on;
                    // Consecutive lines from one person repeat the name for no
                    // reason. After the first, the bubble itself says who.
                    // Words or a card. Neither means an event this panel has
                    // no card for yet; the row is dropped rather than drawn empty.
                    const empty =
                      message.card === null &&
                      (message.body === null || message.body === '');
                    const sameSpeaker =
                      !newDay &&
                      message.card === null &&
                      messages[index - 1]?.card === null &&
                      messages[index - 1]?.mine === message.mine;

                    if (empty) return null;

                    return (
                      <li key={message.id} className="flex flex-col gap-1">
                        {newDay && (
                          <div className="flex items-center gap-3 pb-1">
                            <span aria-hidden className="h-px flex-1 bg-border-subtle" />
                            <span className="text-2xs font-medium text-text-tertiary">
                              {message.on}
                            </span>
                            <span aria-hidden className="h-px flex-1 bg-border-subtle" />
                          </div>
                        )}

                        {message.card !== null ? (
                          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-1">
                            <div className="flex items-start gap-3">
                              <span
                                aria-hidden
                                className={cn(
                                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                                  CARD_TONE[message.card.tone],
                                )}
                              >
                                <Icon name={CARD_ICON[message.card.kind] ?? 'info'} size={16} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-2xs text-text-tertiary">
                                  Recorded by the platform · {message.at}
                                </p>
                                <p className="text-sm font-semibold text-text-primary">
                                  {message.card.title}
                                </p>
                              </div>
                            </div>

                            <dl className="mt-3 flex flex-col gap-1.5">
                              {message.card.rows.map((row) => (
                                <div
                                  key={row.label}
                                  className="flex justify-between gap-4 text-sm"
                                >
                                  <dt className="text-text-tertiary">{row.label}</dt>
                                  <dd className="text-right font-medium text-text-secondary">
                                    {row.value}
                                  </dd>
                                </div>
                              ))}
                            </dl>

                            {message.card.actions.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {message.card.actions.map((action, position) => (
                                  <Link
                                    key={action.href}
                                    href={action.href}
                                    className={buttonAppearance({
                                      variant: position === 0 ? 'primary' : 'secondary',
                                      size: 'sm',
                                    })}
                                  >
                                    {action.label}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            className={cn(
                              'flex flex-col gap-1',
                              message.mine ? 'items-end' : 'items-start',
                            )}
                          >
                            {!sameSpeaker && (
                              <span className="text-xs text-text-tertiary">
                                {message.mine ? 'You' : message.authorName} · {message.at}
                              </span>
                            )}
                            <span
                              className={cn(
                                'max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm',
                                message.mine
                                  ? 'bg-bg-brand text-text-on-brand'
                                  : 'border border-border-subtle bg-bg-surface-raised text-text-secondary',
                              )}
                            >
                              {message.body ?? ''}
                            </span>
                            {message.attachments.length > 0 && (
                              <span className="text-xs text-text-tertiary">
                                {message.attachments.join(', ')}
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
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
                  onKeyDown={(event) => {
                    // Enter sends, Shift+Enter starts a line. Every chat works
                    // this way, and a composer that needs the mouse for the one
                    // thing it does gets used less than it should be.
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      if (body.trim() !== '') send();
                    }
                  }}
                />
              </FormField>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <Text tone="muted" size="xs" className="max-w-measure">
                  Anything agreed here still has to be recorded on the request, the quote
                  or the order to count. Files travel with those, not with a message.
                </Text>
                <Button
                  variant="primary"
                  size="sm"
                  loading={pending || !hydrated}
                  disabled={!hydrated || body.trim() === ''}
                  onClick={send}
                >
                  Send
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

    </div>
  );
};
