'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  FormField,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Text,
  Textarea,
  buttonAppearance,
  useToast,
} from '@ideeza/ui';
import { claimReference, issueReasonLabel, orderReference } from '@ideeza/domain';
import {
  approveRefundAction,
  challengeRefundAction,
} from '@/app/(app)/orders/resolution-actions.js';
import { goTo } from '@/lib/navigate.js';

/**
 * Why a shop agrees to a claim, as the design's "Select Reason" asks.
 *
 * A list rather than free text, because the answer is one of a few and a shop
 * writing it out differently every time makes the record harder to read later.
 * The choice is stored as the opening line of the statement on the claim — it
 * belongs with the shop's own words rather than in a column of its own, since
 * what it means is "here is why", not a fact the platform acts on.
 */
const ACCEPT_REASONS = [
  { value: 'our_fault', label: 'The fault is ours' },
  { value: 'spec_ambiguous', label: 'The specification was ambiguous' },
  { value: 'packing', label: 'Damage from how we packed it' },
  { value: 'faster', label: 'Faster to settle than to argue' },
  { value: 'goodwill', label: 'Goodwill, without accepting fault' },
];

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
  const [share, setShare] = useState<'full' | 'custom'>('full');
  const [acceptAmount, setAcceptAmount] = useState(claimedMajor);
  const [acceptReason, setAcceptReason] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [statement, setStatement] = useState('');
  const router = useRouter();
  const { push } = useToast();

  useEffect(() => setHydrated(true), []);

  const approve = (): void => {
    setError(undefined);
    startTransition(async () => {
      const chosen = ACCEPT_REASONS.find((entry) => entry.value === acceptReason);
      const statement =
        chosen === undefined ? note : `${chosen.label}. ${note}`.trim();
      const result = await approveRefundAction(
        orderId,
        refundId,
        statement,
        share === 'full' ? undefined : acceptAmount,
      );
      if (!result.done) {
        setError(result.error ?? 'That answer was not recorded.');
        return;
      }
      setOpen(null);
      push({
        title: share === 'full' ? 'Claim accepted in full' : 'Amount offered',
        body:
          share === 'full'
            ? 'IDEEZA records the outcome and moves the money; your objection is off the table.'
            : 'IDEEZA weighs what you offered against the claim and decides.',
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
        {claimReference(refundId)} · {issueReasonLabel(reason)} — {description}{' '}
        <Link href={`/orders/${orderId}`} className="text-text-link underline">
          (Order {orderReference(orderId)})
        </Link>
        {!answered && (
          <span className="mt-1 block font-medium text-text-primary">
            Answer by {respondByOn}. If you do not, IDEEZA decides on what is on the
            record, which will be the buyer’s account alone.
          </span>
        )}
      </Alert>

      <Modal
        open={open === 'approve'}
        onClose={() => setOpen(null)}
        title="Refund Request"
        description="Accepting in full ends your objection. Offering an amount is an answer IDEEZA weighs. Either way, IDEEZA moves the money."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Not yet
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              // The terms have to be accepted, because this moves money out of
              // an escrow the platform is holding on this shop's behalf.
              disabled={!hydrated || !accepted || acceptReason === ''}
              onClick={approve}
            >
              Give refund
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

          <FormField label="Select Reason" required>
            <Select
              options={ACCEPT_REASONS}
              placeholder="Select Reason"
              value={acceptReason}
              onChange={(event) => setAcceptReason(event.target.value)}
            />
          </FormField>

          <RadioGroup legend="Refund Amount">
            <Radio
              name="accepted-share"
              label={`The full ${currency} ${claimedMajor}`}
              description="You agree with the claim as it was made."
              checked={share === 'full'}
              onChange={() => setShare('full')}
            />
            <Radio
              name="accepted-share"
              label="An amount of your own"
              description="An offer, not a settlement: operations weighs it against the claim."
              checked={share === 'custom'}
              onChange={() => setShare('custom')}
            />
          </RadioGroup>

          {share === 'custom' && (
            <FormField
              label={`Amount you accept (${currency})`}
              required
              hint={`Above zero and no more than ${currency} ${claimedMajor}.`}
            >
              <Input
                inputMode="decimal"
                value={acceptAmount}
                onChange={(event) => setAcceptAmount(event.target.value)}
              />
            </FormField>
          )}
          <FormField
            label="Description"
            hint="Optional, and both sides read it. Your reason above is recorded with it."
          >
            <Textarea
              rows={3}
              value={note}
              placeholder="If you didn’t complete something, explain why not and if the client changed requirement."
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>
          <Checkbox
            label="I accept the Terms and Conditions"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
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
            <Input value={issueReasonLabel(reason)} readOnly disabled />
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
