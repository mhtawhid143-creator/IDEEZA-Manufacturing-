'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  Button,
  Card,
  CardHeader,
  Checkbox,
  FormField,
  Input,
  Text,
  Textarea,
  useToast,
} from '@ideeza/ui';
import { addStatementAction } from '@/app/(app)/orders/resolution-actions.js';

export interface DisputeStatementProps {
  readonly orderId: string;
  readonly disputeId: string;
  /** Records already on the order, which a statement can carry into the case. */
  readonly attachable: readonly {
    readonly fileId: string;
    readonly name: string;
    readonly origin: string;
  }[];
}

/**
 * Adding to the case.
 *
 * A statement cannot be edited or withdrawn once it is in, which is what makes it
 * worth reading — so the form says so before it is sent.
 */
export const DisputeStatement = ({
  orderId,
  disputeId,
  attachable,
}: DisputeStatementProps) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const router = useRouter();
  const { push } = useToast();

  useEffect(() => setHydrated(true), []);

  const send = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await addStatementAction(orderId, disputeId, title, body, picked);
      if (!result.done) {
        setError(result.error ?? 'That statement was not added.');
        return;
      }
      setTitle('');
      setBody('');
      setPicked([]);
      push({
        title: 'Statement added',
        body: 'The buyer and IDEEZA can read it, and it cannot be edited.',
        tone: 'info',
      });
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader
        title="Add to the case"
        description="Both the buyer and IDEEZA read this. It cannot be edited or withdrawn afterwards."
      />
      <div className="mt-4 flex flex-col gap-4">
        <FormField label="Heading" hint="Optional. What this statement is about.">
          <Input
            value={title}
            placeholder="eg. How the specification was met"
            onChange={(event) => setTitle(event.target.value)}
          />
        </FormField>
        <FormField label="What you want weighed" required>
          <Textarea
            rows={5}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </FormField>
        {attachable.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-text-primary">
              Records to attach
            </legend>
            <Text tone="muted" size="xs" className="mb-1 block">
              Anything already on this order. The case keeps a copy, so operations
              reads the record and your account of it together.
            </Text>
            {attachable.map((record) => (
              <Checkbox
                key={record.fileId}
                label={record.name}
                description={record.origin}
                checked={picked.includes(record.fileId)}
                onChange={(event) =>
                  setPicked((current) =>
                    event.target.checked
                      ? [...current, record.fileId]
                      : current.filter((id) => id !== record.fileId),
                  )
                }
              />
            ))}
          </fieldset>
        )}
        <div className="flex justify-end">
          <Button
            variant="primary"
            loading={pending || !hydrated}
            disabled={!hydrated}
            onClick={send}
          >
            Add the statement
          </Button>
        </div>
        {error !== undefined && (
          <Text tone="danger" size="sm">
            {error}
          </Text>
        )}
      </div>
    </Card>
  );
};
