'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  Badge,
  Button,
  Card,
  Modal,
  Text,
  buttonAppearance,
  cn,
  useToast,
} from '@ideeza/ui';
import { declineReasonLabel } from '@ideeza/domain';
import {
  addRecipientsAction,
  withdrawRequestAction,
} from '@/app/(app)/manufacturing/rfq/actions.js';
import { RECIPIENT_COPY } from '@/lib/rfq-copy.js';
import type { RfqRecipientStatus } from '@ideeza/domain';
import { goTo } from '@/lib/navigate.js';

export interface RecipientRow {
  readonly manufacturerId: string;
  readonly manufacturerName: string;
  readonly city: string;
  readonly countryCode: string;
  readonly rating: number | null;
  readonly status: RfqRecipientStatus;
  readonly viewedAt: string | null;
  readonly quotedAt: string | null;
  readonly declinedAt: string | null;
  readonly declineReason: string | null;
}

export interface AvailableManufacturer {
  readonly id: string;
  readonly displayName: string;
  readonly city: string;
  readonly countryCode: string;
  readonly blocked: boolean;
  readonly blockedReason: string;
}

export interface RequestRecipientsProps {
  readonly rfqId: string;
  readonly open: boolean;
  readonly recipients: readonly RecipientRow[];
  readonly available: readonly AvailableManufacturer[];
}

const TONE: Readonly<Record<RfqRecipientStatus, string>> = {
  routed: 'bg-warning-weak text-warning',
  viewed: 'bg-warning-weak text-warning',
  quoted: 'bg-success-weak text-success',
  declined: 'bg-danger-weak text-danger',
  expired: 'bg-raised text-muted',
};

/**
 * The recipients of a request, and the two things the buyer can still do with
 * it: send it to somebody else, or withdraw it.
 *
 * Reading a quote, accepting one and messaging a manufacturer are the quote
 * task, so this screen shows the state of each recipient and nothing it cannot
 * actually do.
 */
export const RequestRecipients = ({
  rfqId,
  open,
  recipients,
  available,
}: RequestRecipientsProps) => {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [picked, setPicked] = useState<readonly string[]>([]);

  const send = (): void => {
    startTransition(async () => {
      const result = await addRecipientsAction(rfqId, picked);
      if (result.error !== undefined) {
        push({ title: 'Nobody was added', body: result.error, tone: 'danger' });
        return;
      }
      setAdding(false);
      setPicked([]);
      push({
        title:
          result.added === 0
            ? 'They already have it'
            : `Sent to ${result.added} more ${result.added === 1 ? 'manufacturer' : 'manufacturers'}`,
        body: 'The requirements stay locked, so every quote answers the same question.',
        tone: result.added === 0 ? 'info' : 'success',
      });
      router.refresh();
    });
  };

  const withdraw = (): void => {
    startTransition(async () => {
      const result = await withdrawRequestAction(rfqId);
      if (!result.withdrawn) {
        push({
          title: 'That request was not withdrawn',
          body: result.error ?? 'Try again.',
          tone: 'danger',
        });
        return;
      }
      setConfirmWithdraw(false);
      push({
        title: 'Request withdrawn',
        body: 'No manufacturer can quote it now, and the product is free for a new request.',
        tone: 'info',
      });
      goTo(router, '/manufacturing/rfq');
    });
  };

  return (
    <Card padded={false} className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-6">
        <h3 className="text-sm font-semibold text-heading">
          Requested proposals
          <Badge tone="neutral" className="ml-2 align-middle">
            {recipients.length}
          </Badge>
        </h3>
        {open && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              + Send another quote
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmWithdraw(true)}>
              Withdraw request
            </Button>
          </div>
        )}
      </div>

      <ul aria-label="Request recipients" className="flex flex-col">
        {recipients.map((recipient) => {
          const copy = RECIPIENT_COPY[recipient.status];
          return (
            <li
              key={recipient.manufacturerId}
              className="flex flex-col gap-3 border-b border-line p-4 last:border-0 md:px-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-semibold text-brand">
                    {recipient.manufacturerName.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-heading">
                      {recipient.manufacturerName}
                    </p>
                    <p className="truncate text-xs text-body">
                      {recipient.rating !== null && (
                        <span className="font-semibold text-brand">
                          ★ {recipient.rating.toFixed(1)}
                        </span>
                      )}
                      {recipient.rating !== null && ' · '}
                      {recipient.city}, {recipient.countryCode}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                    TONE[recipient.status],
                  )}
                >
                  {copy.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted">Quote</p>
                  <p className="text-sm font-semibold text-brand">
                    {recipient.status === 'quoted' ? 'Quote received' : copy.note}
                  </p>
                </div>
                <Text tone="muted" size="xs">
                  {recipient.declinedAt !== null
                    ? `Declined ${recipient.declinedAt}${recipient.declineReason === null ? '' : ` · ${declineReasonLabel(recipient.declineReason) ?? ''}`}`
                    : recipient.quotedAt !== null
                      ? `Answered ${recipient.quotedAt}`
                      : recipient.viewedAt !== null
                        ? `Opened ${recipient.viewedAt}`
                        : 'Not opened yet'}
                </Text>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Send this request to another manufacturer"
        description="They answer the same locked requirements, so the quotes stay comparable."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button loading={pending} disabled={picked.length === 0} onClick={send}>
              Send to {picked.length === 0 ? 'selected' : picked.length}
            </Button>
          </div>
        }
      >
        {available.length === 0 ? (
          <Text>
            Every manufacturer that can build this request already has it.{' '}
            <Link href="/manufacturing/rfq" className="font-semibold text-brand underline">
              Back to requests
            </Link>
          </Text>
        ) : (
          <ul className="flex flex-col gap-2">
            {available.map((manufacturer) => (
              <li key={manufacturer.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3',
                    picked.includes(manufacturer.id)
                      ? 'border-brand bg-brand-surface'
                      : 'border-line',
                    manufacturer.blocked && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 appearance-none rounded border-2 border-line-input bg-surface checked:border-brand checked:bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                    checked={picked.includes(manufacturer.id)}
                    disabled={manufacturer.blocked}
                    onChange={(event) =>
                      setPicked((current) =>
                        event.target.checked
                          ? [...current, manufacturer.id]
                          : current.filter((entry) => entry !== manufacturer.id),
                      )
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-heading">
                      {manufacturer.displayName}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {manufacturer.blocked
                        ? manufacturer.blockedReason
                        : `${manufacturer.city}, ${manufacturer.countryCode}`}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={confirmWithdraw}
        onClose={() => setConfirmWithdraw(false)}
        title="Withdraw this request?"
        description="Every recipient stops being able to quote it. This cannot be undone."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmWithdraw(false)}>
              Keep the request
            </Button>
            <Button variant="danger" loading={pending} onClick={withdraw}>
              Withdraw
            </Button>
          </div>
        }
      >
        <Text>
          You can withdraw a request until you accept a quote. The board, the files
          and the requirements stay on record.
        </Text>
        <div className="mt-3">
          <Link
            href="/manufacturing/rfq"
            className={buttonAppearance({ variant: 'ghost', size: 'xs' })}
          >
            See all requests
          </Link>
        </div>
      </Modal>
    </Card>
  );
};
