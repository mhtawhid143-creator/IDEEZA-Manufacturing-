'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Alert, Button, Checkbox, FormField, Text, Textarea, useToast } from '@ideeza/ui';
import { addDisputeStatementAction } from '@/app/(app)/manufacturing/orders/issue-actions.js';
import { goTo } from '@/lib/navigate.js';

export interface DisputeStatementFormProps {
  readonly orderId: string;
  readonly disputeId: string;
  readonly attachable: readonly {
    readonly fileId: string;
    readonly name: string;
    readonly origin: string;
  }[];
}

/**
 * Adding to a live dispute.
 *
 * Everything either side writes becomes part of the record the case is decided
 * on, which is why it is worded as a statement rather than as a chat message.
 */
export const DisputeStatementForm = ({
  orderId,
  disputeId,
  attachable,
}: DisputeStatementFormProps) => {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const [statement, setStatement] = useState('');
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  const submit = (): void => {
    if (statement.trim().length < 10) {
      setError('Write at least a sentence.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addDisputeStatementAction({
        orderId,
        disputeId,
        statement: statement.trim(),
        evidenceFileIds: picked,
      });
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      setStatement('');
      setPicked([]);
      push({
        title: 'Statement added',
        body: 'It is now part of the record this case is decided on.',
        tone: 'success',
      });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <FormField label="Describe" hint="It is added to the case, for both sides to read.">
        <Textarea
          rows={4}
          value={statement}
          onChange={(event) => {
            setStatement(event.target.value);
            setError(null);
          }}
          placeholder="Write here"
        />
      </FormField>

      {attachable.length > 0 && (
        <div>
          <p className="text-sm font-medium text-text-primary">Attachment</p>
          <Text tone="muted" size="xs" className="mt-0.5">
            Records already on this order. New photographs need the file storage
            service, which is part of the deployment work.
          </Text>
          <ul className="mt-2 flex flex-col gap-2">
            {attachable.map((record) => (
              <li key={record.fileId}>
                <Checkbox
                  label={record.name}
                  description={record.origin}
                  checked={picked.includes(record.fileId)}
                  onChange={() =>
                    setPicked((current) =>
                      current.includes(record.fileId)
                        ? current.filter((id) => id !== record.fileId)
                        : [...current, record.fileId],
                    )
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {error !== null && (
        <Alert tone="danger" title="Nothing was added">
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
          Submit
        </Button>
      </div>
    </div>
  );
};
