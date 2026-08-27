'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  Button,
  FormField,
  Modal,
  Select,
  Text,
  Textarea,
  useToast,
} from '@ideeza/ui';
import { RFQ_DECLINE_REASON_LABEL, RFQ_DECLINE_REASONS } from '@ideeza/domain';
import { declineRequestAction } from '@/app/(app)/rfqs/actions.js';
import { goTo } from '@/lib/navigate.js';

export interface DeclineRequestProps {
  readonly rfqId: string;
  readonly productName: string;
}

const OPTIONS = RFQ_DECLINE_REASONS.map((reason) => ({
  value: reason,
  label: RFQ_DECLINE_REASON_LABEL[reason],
}));

/**
 * Declining, with the reason on the record.
 *
 * A reason is required because the buyer reads it: "no" with nothing attached
 * tells them nothing about whether to change the ask or the shop. "Other" is in
 * the list, and choosing it makes the note the reason, so nobody is forced into a
 * category that does not fit.
 */
export const DeclineRequest = ({ rfqId, productName }: DeclineRequestProps) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  useEffect(() => setHydrated(true), []);

  const submit = (): void => {
    if (reason === '') {
      setError('Choose the reason the buyer will see.');
      return;
    }
    if (reason === 'other' && note.trim() === '') {
      setError('Say what the reason is, since it is not one of the listed ones.');
      return;
    }
    setError(undefined);

    startTransition(async () => {
      const result = await declineRequestAction(rfqId, reason, note);
      if (!result.declined) {
        setError(result.error ?? 'That decline was not recorded.');
        return;
      }
      setOpen(false);
      push({
        title: 'Request declined',
        body: `${productName} is no longer in your inbox, and the buyer can see why.`,
        tone: 'info',
      });
      goTo(router, '/rfqs?declined=1');
    });
  };

  return (
    <>
      <Button
        variant="secondary"
        className="w-full justify-center"
        onClick={() => setOpen(true)}
      >
        Decline
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Decline this request?"
        description="It leaves your inbox and the buyer is told the reason."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={submit}
            >
              Decline request
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Text size="sm">
            Nothing is cancelled for the buyer: other shops they asked can still
            quote <span className="font-semibold">{productName}</span>.
          </Text>

          <FormField
            label="Reason"
            required
            error={error === undefined || reason !== '' ? undefined : error}
          >
            <Select
              name="reason"
              options={OPTIONS}
              placeholder="Choose a reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>

          <FormField
            label="Note for the buyer"
            hint={
              reason === 'other'
                ? 'Required, because "other" says nothing on its own.'
                : 'Optional. Anything that would help them come back with a request you can take.'
            }
          >
            <Textarea
              name="note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>

          {error !== undefined && reason !== '' && (
            <Text tone="danger" size="sm">
              {error}
            </Text>
          )}
        </div>
      </Modal>
    </>
  );
};
