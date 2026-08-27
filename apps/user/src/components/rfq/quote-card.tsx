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
import { acceptQuoteAction, rejectQuoteAction } from '@/app/(app)/manufacturing/rfq/actions.js';
import type { QuoteStatus } from '@ideeza/domain';
import { goTo } from '@/lib/navigate.js';

export interface QuoteCardData {
  readonly id: string;
  readonly rfqId: string;
  readonly manufacturerName: string;
  readonly city: string;
  readonly countryCode: string;
  readonly rating: number | null;
  readonly status: QuoteStatus;
  readonly expired: boolean;
  readonly currency: string;
  readonly totalMajor: string;
  readonly unitMajor: string;
  readonly leadTimeDays: number;
  readonly expiresOn: string;
  readonly pendingSubstitutions: number;
  readonly orderId: string | null;
}

const STATE: Readonly<Record<string, { readonly label: string; readonly tone: string }>> = {
  submitted: { label: 'Quote received', tone: 'bg-success-weak text-success' },
  revised: { label: 'Revised quote', tone: 'bg-info-weak text-info' },
  revision_requested: { label: 'Revision requested', tone: 'bg-warning-weak text-warning' },
  accepted: { label: 'Accepted', tone: 'bg-brand-weak text-brand' },
  rejected: { label: 'Declined by you', tone: 'bg-danger-weak text-danger' },
  withdrawn: { label: 'Withdrawn', tone: 'bg-raised text-muted' },
  expired: { label: 'Expired', tone: 'bg-raised text-muted' },
};

/**
 * One quote, as the design shows it: who answered, what it costs, and the
 * decision the buyer can take.
 *
 * Accepting is the platform's hinge, so it is confirmed first and the wording
 * says what actually happens: an order opens, and it is not confirmed until the
 * payment is secured.
 */
export const QuoteCard = ({ quote }: { readonly quote: QuoteCardData }) => {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [declining, setDeclining] = useState(false);

  const state = quote.expired && quote.status === 'submitted' ? STATE['expired'] : STATE[quote.status];
  const decidable = quote.status === 'submitted' || quote.status === 'revised';
  const acceptable = decidable && !quote.expired && quote.pendingSubstitutions === 0;

  const accept = (): void => {
    startTransition(async () => {
      const result = await acceptQuoteAction(quote.id);
      if (result.error !== undefined) {
        push({ title: 'That quote was not accepted', body: result.error, tone: 'danger' });
        return;
      }
      setConfirming(false);
      push({
        title: 'Quote accepted',
        body: 'An order is open and awaiting payment. It is confirmed once the payment is secured.',
        tone: 'success',
      });
      goTo(router, `/manufacturing/orders/${result.orderId}?created=1`);
    });
  };

  const decline = (): void => {
    startTransition(async () => {
      const result = await rejectQuoteAction(quote.id);
      if (result.error !== undefined) {
        push({ title: 'That quote was not declined', body: result.error, tone: 'danger' });
        return;
      }
      setDeclining(false);
      push({ title: 'Quote declined', body: `${quote.manufacturerName} has been told.`, tone: 'info' });
      router.refresh();
    });
  };

  return (
    <Card padded={false} className="flex flex-col" data-testid={`quote-${quote.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-semibold text-brand">
            {quote.manufacturerName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-heading">{quote.manufacturerName}</p>
            <p className="truncate text-xs text-body">
              {quote.rating !== null && (
                <span className="font-semibold text-brand">★ {quote.rating.toFixed(1)}</span>
              )}
              {quote.rating !== null && ' · '}
              {quote.city}, {quote.countryCode}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
            state?.tone ?? 'bg-raised text-muted',
          )}
        >
          {state?.label ?? quote.status}
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted">Quote total</p>
          <p className="text-xl font-semibold text-brand">
            {quote.currency} {quote.totalMajor}
          </p>
          <Text tone="muted" size="xs" className="mt-0.5">
            {quote.currency} {quote.unitMajor} per unit · {quote.leadTimeDays} days ·{' '}
            {quote.expired ? 'expired' : `valid to ${quote.expiresOn}`}
          </Text>
          {quote.pendingSubstitutions > 0 && (
            <Badge tone="warning" className="mt-2">
              {quote.pendingSubstitutions} replacement part
              {quote.pendingSubstitutions === 1 ? '' : 's'} need a decision
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/manufacturing/rfq/${quote.rfqId}/quotes/${quote.id}`}
            className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
          >
            View details
          </Link>
          {quote.status === 'accepted' && quote.orderId !== null && (
            <Link
              href={`/manufacturing/orders/${quote.orderId}`}
              className={buttonAppearance({ size: 'sm' })}
            >
              Go to order
            </Link>
          )}
          {decidable && (
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => setDeclining(true)}
              >
                Decline
              </Button>
              <Button
                size="sm"
                disabled={!acceptable || pending}
                onClick={() => setConfirming(true)}
              >
                Accept quote
              </Button>
            </>
          )}
          {quote.pendingSubstitutions > 0 && (
            <Link
              href={`/manufacturing/rfq/${quote.rfqId}/substitutions`}
              className={buttonAppearance({ variant: 'outline', size: 'sm' })}
            >
              Decide parts
            </Link>
          )}
        </div>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Accept ${quote.manufacturerName}'s quote?`}
        description="This closes the request, and every other quote on it loses."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Not yet
            </Button>
            <Button loading={pending} onClick={accept}>
              Accept quote
            </Button>
          </div>
        }
      >
        <Text>
          Accepting does <span className="font-semibold">not</span> create a confirmed
          order. An order opens <span className="font-semibold">awaiting payment</span> for{' '}
          {quote.currency} {quote.totalMajor}; it is confirmed — and production may start
          — once the platform holds the funds.
        </Text>
      </Modal>

      <Modal
        open={declining}
        onClose={() => setDeclining(false)}
        title={`Decline ${quote.manufacturerName}'s quote?`}
        description="The other quotes on this request are unaffected."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeclining(false)}>
              Keep it
            </Button>
            <Button variant="danger" loading={pending} onClick={decline}>
              Decline
            </Button>
          </div>
        }
      >
        <Text>
          The decision is recorded. You can still accept any other quote while the
          request is open.
        </Text>
      </Modal>
    </Card>
  );
};
