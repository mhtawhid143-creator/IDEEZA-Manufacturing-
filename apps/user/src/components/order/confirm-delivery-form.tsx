'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Alert, Button, Checkbox, FormField, Textarea, useToast } from '@ideeza/ui';
import { confirmDeliveryAction } from '@/app/(app)/manufacturing/orders/delivery-actions.js';
import { goTo } from '@/lib/navigate.js';

export interface ConfirmDeliveryFormProps {
  readonly orderId: string;
  readonly manufacturerName: string;
  readonly heldLabel: string;
}

/**
 * Confirming delivery, with the consequence stated before the button.
 *
 * This is the one buyer action that sends money out of escrow, so it is not a
 * one-click affair: the buyer says explicitly that what arrived matches the
 * accepted terms, and is told what to do instead if it does not.
 */
export const ConfirmDeliveryForm = ({
  orderId,
  manufacturerName,
  heldLabel,
}: ConfirmDeliveryFormProps) => {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  const confirm = (): void => {
    setError(null);
    startTransition(async () => {
      const result = await confirmDeliveryAction(orderId, note);
      if (result.error !== undefined || result.redirectTo === undefined) {
        setError(result.error ?? 'The confirmation could not be recorded.');
        return;
      }
      push({
        title: 'Delivery confirmed',
        body:
          result.payoutReleased === true
            ? `${heldLabel} has been released to ${manufacturerName}.`
            : 'The order is complete. The payout is held while an issue is open.',
        tone: 'success',
      });
      goTo(router, result.redirectTo);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <FormField
        label="Anything worth recording"
        hint="Optional. It is kept with the order as your statement."
      >
        <Textarea
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Packaging, count, condition on arrival"
        />
      </FormField>

      <Checkbox
        label={`What arrived matches the accepted terms, and ${heldLabel} may be released to ${manufacturerName}.`}
        description="Confirming is what releases the money. If something is wrong, request a refund or open a dispute instead — both keep the funds held."
        checked={agreed}
        onChange={(event) => setAgreed(event.target.checked)}
      />

      {error !== null && (
        <Alert tone="danger" title="Nothing was confirmed">
          {error}
        </Alert>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          onClick={confirm}
          disabled={!hydrated || !agreed || pending}
          loading={pending || !hydrated}
        >
          Confirm delivery and release the money
        </Button>
      </div>
    </div>
  );
};
