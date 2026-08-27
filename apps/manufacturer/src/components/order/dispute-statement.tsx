'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Button, Card, CardHeader, FormField, Input, Text, Textarea, useToast } from '@ideeza/ui';
import { addStatementAction } from '@/app/(app)/orders/resolution-actions.js';

export interface DisputeStatementProps {
  readonly orderId: string;
  readonly disputeId: string;
}

/**
 * Adding to the case.
 *
 * A statement cannot be edited or withdrawn once it is in, which is what makes it
 * worth reading — so the form says so before it is sent.
 */
export const DisputeStatement = ({ orderId, disputeId }: DisputeStatementProps) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const router = useRouter();
  const { push } = useToast();

  useEffect(() => setHydrated(true), []);

  const send = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await addStatementAction(orderId, disputeId, title, body);
      if (!result.done) {
        setError(result.error ?? 'That statement was not added.');
        return;
      }
      setTitle('');
      setBody('');
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
