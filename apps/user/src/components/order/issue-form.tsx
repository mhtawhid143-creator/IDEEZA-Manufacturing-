'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  FormField,
  Input,
  Select,
  Text,
  Textarea,
  useToast,
} from '@ideeza/ui';
import {
  cancelOrderAction,
  openDisputeAction,
  requestRefundAction,
} from '@/app/(app)/manufacturing/orders/issue-actions.js';
import { goTo } from '@/lib/navigate.js';

export type IssueKind = 'cancel' | 'refund' | 'dispute';

export interface IssueFormProps {
  readonly kind: IssueKind;
  readonly orderId: string;
  readonly currency: string;
  /** What was paid for the order, which caps a claim. */
  readonly paidMinor: number;
  /** Whether that money is still held, which changes what a claim can do. */
  readonly moneyReleased: boolean;
  readonly reasons: readonly { readonly value: string; readonly label: string }[];
  readonly attachable: readonly {
    readonly fileId: string;
    readonly name: string;
    readonly origin: string;
  }[];
  /** Whether an amount is asked for, as the refund and dispute forms do. */
  readonly withAmount: boolean;
  /** Whether records must be attached, as a claim does. */
  readonly withRecords: boolean;
  readonly submitLabel: string;
  readonly refundId?: string | undefined;
}

const minorFrom = (input: string): number => {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (cleaned === '') return 0;
  return Math.round(Number(cleaned) * 100);
};

/**
 * One form behind the design's three "Select Reason / Amount / Description"
 * modals.
 *
 * They differ in what the platform needs, not in how they look: cancelling asks
 * why, a claim also asks how much and what it rests on. Records are picked from
 * what the order already holds, because this build has no file storage — that is
 * said on the form rather than hidden behind a dead upload box.
 */
export const IssueForm = ({
  kind,
  orderId,
  currency,
  paidMinor,
  moneyReleased,
  reasons,
  attachable,
  withAmount,
  withRecords,
  submitLabel,
  refundId,
}: IssueFormProps) => {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState((paidMinor / 100).toFixed(2));
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  const toggle = (fileId: string): void => {
    setPicked((current) =>
      current.includes(fileId)
        ? current.filter((id) => id !== fileId)
        : [...current, fileId],
    );
    setError(null);
  };

  const submit = (): void => {
    if (reason === '') {
      setError('Choose a reason.');
      return;
    }
    if (description.trim().length < (kind === 'cancel' ? 10 : 20)) {
      setError(
        kind === 'cancel'
          ? 'Say why in a sentence, so the request can be decided without a follow-up.'
          : 'Describe what went wrong in at least a couple of sentences.',
      );
      return;
    }
    if (withRecords && picked.length === 0) {
      setError('Attach at least one record from the order.');
      return;
    }
    const amountMinor = withAmount ? minorFrom(amount) : 0;
    if (withAmount && (amountMinor <= 0 || amountMinor > paidMinor)) {
      setError(
        `Enter an amount between ${currency} 0.01 and ${currency} ${(paidMinor / 100).toFixed(2)}.`,
      );
      return;
    }

    setError(null);
    startTransition(async () => {
      const result =
        kind === 'cancel'
          ? await cancelOrderAction({ orderId, reason, description })
          : kind === 'refund'
            ? await requestRefundAction({
                orderId,
                reason,
                amountMinor,
                currency,
                description,
                evidenceFileIds: picked,
              })
            : await openDisputeAction({
                orderId,
                reason,
                amountMinor,
                currency,
                statement: description,
                evidenceFileIds: picked,
                ...(refundId === undefined ? {} : { refundId }),
              });

      if (result.error !== undefined || result.redirectTo === undefined) {
        setError(result.error ?? 'Nothing was recorded.');
        return;
      }

      push({
        title:
          kind === 'cancel'
            ? result.note === 'withdraw'
              ? 'Order withdrawn'
              : 'Cancellation requested'
            : kind === 'refund'
              ? 'Refund claim recorded'
              : 'Dispute opened',
        body:
          kind === 'cancel'
            ? result.note === 'withdraw'
              ? 'Nothing was being made, so the order is closed.'
              : 'IDEEZA decides it. Production continues until then.'
            : 'The payout is held while this is decided.',
        tone: kind === 'cancel' && result.note === 'withdraw' ? 'info' : 'success',
      });
      goTo(router, result.redirectTo);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <FormField label="Select reason" required>
        <Select
          value={reason}
          placeholder="Select reason"
          options={reasons.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          onChange={(event) => {
            setReason(event.target.value);
            setError(null);
          }}
        />
      </FormField>

      {withAmount && (
        <FormField
          label="Amount"
          required
          hint={
            moneyReleased
              ? `At most ${currency} ${(paidMinor / 100).toFixed(2)}, which is what you paid. That money has already been released, so IDEEZA would recover it from the manufacturer.`
              : `At most ${currency} ${(paidMinor / 100).toFixed(2)}, which is what IDEEZA is holding.`
          }
        >
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
          />
        </FormField>
      )}

      <FormField
        label="Description"
        required
        hint={
          kind === 'cancel'
            ? 'What changed, and when you decided.'
            : 'What is wrong, how you found it, and what you want done.'
        }
      >
        <Textarea
          rows={4}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setError(null);
          }}
          placeholder="Describe your reason"
        />
      </FormField>

      {withRecords && (
        <div>
          <p className="text-sm font-medium text-heading">
            Attach records from this order
          </p>
          <Text tone="muted" size="xs" className="mt-0.5">
            A claim is decided on the record. Pick what supports it — the files sent
            with the request, and anything the manufacturer attached during production.
          </Text>
          <ul className="mt-2 flex flex-col gap-2">
            {attachable.length === 0 ? (
              <li>
                <Text tone="muted" size="sm">
                  This order has no attachable records.
                </Text>
              </li>
            ) : (
              attachable.map((record) => (
                <li key={record.fileId}>
                  <Checkbox
                    label={record.name}
                    description={record.origin}
                    checked={picked.includes(record.fileId)}
                    onChange={() => toggle(record.fileId)}
                  />
                </li>
              ))
            )}
          </ul>
          <Text tone="muted" size="xs" className="mt-2">
            Uploading new photographs needs the file storage service, which is wired up
            in the deployment work. Until then, describe what you have and IDEEZA will
            ask for it directly.
          </Text>
        </div>
      )}

      {error !== null && (
        <Alert tone="danger" title="Nothing was recorded">
          {error}
        </Alert>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => goTo(router, `/manufacturing/orders/${orderId}`)}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={!hydrated || pending}
          loading={pending || !hydrated}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};
