'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  Text,
  Textarea,
  buttonAppearance,
  useToast,
} from '@ideeza/ui';
import {
  approveRefundAction,
  challengeRefundAction,
} from '@/app/(app)/orders/resolution-actions.js';
import { goTo } from '@/lib/navigate.js';

export interface RefundBannerProps {
  readonly orderId: string;
  readonly refundId: string;
  readonly buyerName: string;
  readonly currency: string;
  readonly claimedMajor: string;
  readonly reason: string;
  readonly description: string;
  readonly respondByOn: string;
  readonly answered: boolean;
  readonly disputeId: string | null;
}

/**
 * A refund the buyer has claimed, and the two answers a shop has.
 *
 * The wording says what happens if nobody answers, because that is the part a
 * shop needs to know: the platform is holding the money, and silence is a
 * decision. Neither answer decides the outcome — accepting takes the shop's
 * objection off the table, challenging puts the case to operations.
 */
export const RefundBanner = ({
  orderId,
  refundId,
  buyerName,
  currency,
  claimedMajor,
  reason,
  description,
  respondByOn,
  answered,
  disputeId,
}: RefundBannerProps) => {
  const [open, setOpen] = useState<'approve' | 'dispute' | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('0.00');
  const [statement, setStatement] = useState('');
  const router = useRouter();
  const { push } = useToast();

  useEffect(() => setHydrated(true), []);

  const approve = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await approveRefundAction(orderId, refundId, note);
      if (!result.done) {
        setError(result.error ?? 'That answer was not recorded.');
        return;
      }
      setOpen(null);
      push({
        title: 'Claim accepted',
        body: 'IDEEZA records the outcome and moves the money; your objection is off the table.',
        tone: 'info',
      });
      router.refresh();
    });
  };

  const challenge = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await challengeRefundAction(orderId, refundId, amount, statement);
      if (!result.done) {
        setError(result.error ?? 'That challenge was not recorded.');
        return;
      }
      setOpen(null);
      push({
        title: 'Dispute opened',
        body: 'Operations decides it, and the buyer reads your statement.',
        tone: 'info',
      });
      if (result.disputeId !== undefined) {
        goTo(router, `/orders/${orderId}/disputes/${result.disputeId}`);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <>
      <Alert
        tone={answered ? 'info' : 'danger'}
        title={
          answered
            ? `You have answered ${buyerName}’s refund claim`
            : `${buyerName} has claimed a refund of ${currency} ${claimedMajor}`
        }
        actions={
          answered ? (
            disputeId === null ? undefined : (
              <Link
                href={`/orders/${orderId}/disputes/${disputeId}`}
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                Open the case
              </Link>
            )
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setOpen('dispute')}>
                Dispute
              </Button>
              <Button variant="primary" size="sm" onClick={() => setOpen('approve')}>
                Approve
              </Button>
            </div>
          )
        }
      >
        {reason.replace(/_/g, ' ')} — {description}
        {!answered && (
          <span className="mt-1 block font-medium text-heading">
            Answer by {respondByOn}. If you do not, IDEEZA decides on what is on the
            record, which will be the buyer’s account alone.
          </span>
        )}
      </Alert>

      <Modal
        open={open === 'approve'}
        onClose={() => setOpen(null)}
        title="Accept this refund claim?"
        description="It takes your objection off the table. IDEEZA still records the outcome and moves the money."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Not yet
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={approve}
            >
              Accept the claim
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Text>
            {buyerName} claimed {currency} {claimedMajor}. Accepting means you agree the
            claim is fair; the payout on this order is reduced by whatever operations
            releases to them.
          </Text>
          <FormField label="Anything to add" hint="Optional, and both sides read it.">
            <Textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>
          {error !== undefined && (
            <Text tone="danger" size="sm">
              {error}
            </Text>
          )}
        </div>
      </Modal>

      <Modal
        open={open === 'dispute'}
        onClose={() => setOpen(null)}
        title="Send dispute request"
        description="Operations weighs your account against the buyer's and decides."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={challenge}
            >
              Submit dispute
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Claim" hint="What the buyer says went wrong.">
            <Input value={reason.replace(/_/g, ' ')} readOnly disabled />
          </FormField>
          <FormField
            label={`Amount you would accept (${currency})`}
            required
            hint={`Up to ${currency} ${claimedMajor}. Nothing is a fair answer if you dispute the whole claim.`}
          >
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FormField>
          <FormField
            label="What happened"
            required
            hint="The records on the order are already part of the case; this is your account of it."
          >
            <Textarea
              rows={5}
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
            />
          </FormField>
          <Alert tone="info" title="Records rather than attachments">
            Everything already attached to this order — quality reports, measurements,
            the shipping record — travels with the case. There is nothing to upload.
          </Alert>
          {error !== undefined && (
            <Text tone="danger" size="sm">
              {error}
            </Text>
          )}
        </div>
      </Modal>
    </>
  );
};
