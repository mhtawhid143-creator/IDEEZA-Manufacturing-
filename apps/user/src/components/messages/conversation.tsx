'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Alert, Avatar, Button, buttonAppearance, cn, Icon, Text } from '@ideeza/ui';
import {
  markThreadReadAction,
  sendMessageAction,
} from '@/app/(app)/notifications/actions.js';

export interface CardView {
  readonly kind: string;
  readonly title: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
  readonly actions: readonly { readonly label: string; readonly href: string }[];
}

export interface MessageView {
  readonly id: string;
  readonly authorName: string;
  readonly authorRole: string;
  readonly mine: boolean;
  readonly body: string | null;
  readonly when: string;
  readonly card: CardView | null;
  readonly attachments: readonly string[];
}

export interface ConversationProps {
  readonly threadId: string;
  readonly counterpartName: string;
  readonly contextLabel: string;
  readonly contextHref: string | null;
  readonly messages: readonly MessageView[];
  readonly actions: readonly { readonly label: string; readonly href: string }[];
}

/**
 * One conversation, with the platform's own events in it.
 *
 * The cards are rendered from recorded domain events rather than from anything a
 * party typed, so what the thread says about a quote or an order is always what
 * actually happened. Deciding on a quote is not done here: acceptance carries
 * invariants and a confirmation, so the card links to the screen that owns it.
 */
export const Conversation = ({
  threadId,
  counterpartName,
  contextLabel,
  contextHref,
  messages,
  actions,
}: ConversationProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void markThreadReadAction(threadId);
  }, [threadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const send = (): void => {
    if (body.trim() === '') return;
    setError(null);
    startTransition(async () => {
      const result = await sendMessageAction({ threadId, body: body.trim() });
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      setBody('');
      router.refresh();
    });
  };

  return (
    <div className="flex h-full min-h-[32rem] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={counterpartName} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">
              {counterpartName}
            </p>
            {contextHref === null ? (
              <Text tone="muted" size="xs">
                {contextLabel}
              </Text>
            ) : (
              <Link
                href={contextHref}
                className="text-xs font-medium text-text-brand underline hover:no-underline"
              >
                {contextLabel}
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
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

      <ol
        aria-label="Messages"
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5"
      >
        {messages.length === 0 && (
          <li>
            <Text tone="muted" size="sm">
              Nothing has been said in this thread yet.
            </Text>
          </li>
        )}

        {messages.map((message) => (
          <li
            key={message.id}
            className={cn('flex flex-col gap-1', message.mine ? 'items-end' : 'items-start')}
          >
            <Text tone="muted" size="xs">
              {message.mine ? 'You' : message.authorName} · {message.when}
            </Text>

            {message.body !== null && message.body !== '' && (
              <p
                className={cn(
                  'max-w-[36rem] rounded-2xl px-3.5 py-2.5 text-sm',
                  message.mine
                    ? 'bg-bg-brand text-text-on-brand'
                    : 'bg-bg-surface-raised text-text-secondary border border-border-subtle',
                )}
              >
                {message.body}
              </p>
            )}

            {message.card !== null && (
              <div className="w-full max-w-[36rem] rounded-xl border border-border-subtle bg-bg-surface p-4">
                <Text tone="muted" size="xs">
                  From the order record
                </Text>
                <p className="text-sm font-semibold text-text-primary">{message.card.title}</p>
                <dl className="mt-3 flex flex-col gap-1.5">
                  {message.card.rows.map((row) => (
                    <div key={row.label} className="flex justify-between gap-4 text-sm">
                      <dt className="text-text-tertiary">{row.label}</dt>
                      <dd className="font-medium text-text-secondary">{row.value}</dd>
                    </div>
                  ))}
                </dl>
                {message.card.actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.card.actions.map((action, index) => (
                      <Link
                        key={action.href}
                        href={action.href}
                        className={buttonAppearance({
                          variant: index === 0 ? 'primary' : 'secondary',
                          size: 'sm',
                        })}
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {message.attachments.length > 0 && (
              <Text tone="muted" size="xs">
                Attached: {message.attachments.join(', ')}
              </Text>
            )}
          </li>
        ))}
        <div ref={endRef} />
      </ol>

      {error !== null && (
        <div className="px-4 pb-2">
          <Alert tone="danger" title="That message was not sent">
            {error}
          </Alert>
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-border-subtle px-4 py-3">
        <label htmlFor={`composer-${threadId}`} className="sr-only">
          Type your message
        </label>
        <textarea
          id={`composer-${threadId}`}
          rows={2}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Type your message…"
          className="min-w-0 flex-1 resize-none rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-secondary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
        />
        <Button
          onClick={send}
          disabled={pending || body.trim() === ''}
          loading={pending}
          leadingIcon=<Icon name="send" />
        >
          Send
        </Button>
      </div>
      <Text tone="muted" size="xs" className="px-4 pb-3">
        Files are attached from the order record on the refund and dispute screens;
        attaching new files here needs the storage service, which is deployment work.
      </Text>
    </div>
  );
};
