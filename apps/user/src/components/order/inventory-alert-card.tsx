'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Card,
  FormField,
  Radio,
  StatusChip,
  Text,
  Textarea,
  useToast,
} from '@ideeza/ui';
import { answerInventoryAlertAction } from '@/app/(app)/manufacturing/orders/actions.js';
import type { InventoryResolution } from '@ideeza/domain';

export interface AlertRowProps {
  readonly id: string;
  readonly status: 'open' | 'substitute_approved' | 'part_dropped' | 'stock_awaited';
  readonly partReference: string;
  readonly partName: string;
  readonly shortfallQuantity: number;
  readonly note: string;
  readonly suggestedPartName: string | null;
  readonly technicalJustification: string | null;
  readonly currency: string;
  readonly priceImpactMajor: string;
  readonly creditMajor: string;
  readonly leadTimeImpactDays: number;
  readonly restockLeadTimeDays: number | null;
  readonly raisedByName: string;
  readonly raisedOn: string;
  readonly decidedOn: string | null;
  readonly decisionNote: string | null;
}

const OPTION_LABEL: Readonly<Record<InventoryResolution, string>> = {
  approve_substitute: 'Approve the replacement part',
  drop_part: 'Drop the part and take the credit',
  wait_for_stock: 'Wait for the original part to come back in stock',
};

/**
 * A shortage the manufacturer hit, and the buyer's answer to it.
 *
 * The accepted terms are frozen, so nobody may quietly change what is being
 * built: the manufacturer states the gap, and the buyer picks one of the three
 * things that can actually happen. Each option says what it does to the price
 * and to the promised dates before it is chosen, and the decision is written
 * into the order's record.
 */
export const InventoryAlertCard = ({ alert }: { readonly alert: AlertRowProps }) => {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<InventoryResolution | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const options: readonly InventoryResolution[] = [
    ...(alert.suggestedPartName === null
      ? []
      : (['approve_substitute'] as const)),
    'drop_part' as const,
    ...(alert.restockLeadTimeDays === null ? [] : (['wait_for_stock'] as const)),
  ];

  const impact = (resolution: InventoryResolution): string => {
    if (resolution === 'approve_substitute') {
      const money =
        alert.priceImpactMajor === '0.00'
          ? 'no change to the price'
          : `+${alert.currency} ${alert.priceImpactMajor}`;
      const days =
        alert.leadTimeImpactDays === 0
          ? 'no change to the dates'
          : alert.leadTimeImpactDays > 0
            ? `${alert.leadTimeImpactDays} days later`
            : `${Math.abs(alert.leadTimeImpactDays)} days sooner`;
      return `${money} · ${days}`;
    }
    if (resolution === 'drop_part') {
      return `−${alert.currency} ${alert.creditMajor} credited · the units ship without it`;
    }
    return `no change to the price · about ${alert.restockLeadTimeDays ?? 0} days later`;
  };

  const answer = (): void => {
    if (choice === null) {
      setError('Choose what should happen.');
      return;
    }
    if (choice === 'drop_part' && note.trim().length < 4) {
      setError('Say what should happen to the gap dropping the part leaves.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await answerInventoryAlertAction({
        alertId: alert.id,
        resolution: choice,
        ...(note.trim() === '' ? {} : { note: note.trim() }),
      });
      if (result.error !== undefined) {
        setError(result.error);
        push({ title: 'That answer was not saved', body: result.error, tone: 'danger' });
        return;
      }
      push({
        title: 'The manufacturer has your answer',
        body: OPTION_LABEL[choice],
        tone: 'success',
      });
      router.refresh();
    });
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">
            {alert.partReference} · {alert.partName}
          </p>
          <Text tone="muted" size="xs" className="mt-0.5">
            {alert.shortfallQuantity} short · raised by {alert.raisedByName} on{' '}
            {alert.raisedOn}
          </Text>
        </div>
        <StatusChip
          status={alert.status}
          withDot
          {...(alert.status === 'open' ? { label: 'Needs your answer' } : {})}
        />
      </div>

      <Text size="sm">{alert.note}</Text>

      {alert.suggestedPartName !== null && (
        <div className="rounded-lg border border-border-subtle bg-bg-surface-raised p-3">
          <Text tone="muted" size="xs">
            Suggested instead
          </Text>
          <p className="text-sm font-semibold text-text-primary">{alert.suggestedPartName}</p>
          {alert.technicalJustification !== null && (
            <Text size="sm" className="mt-1">
              {alert.technicalJustification}
            </Text>
          )}
        </div>
      )}

      {alert.status === 'open' ? (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold text-text-primary">
              What should the manufacturer do?
            </legend>
            {options.map((option) => (
              <Radio
                key={option}
                name={`alert-${alert.id}`}
                label={OPTION_LABEL[option]}
                description={impact(option)}
                checked={choice === option}
                onChange={() => {
                  setChoice(option);
                  setError(null);
                }}
              />
            ))}
          </fieldset>

          <FormField
            label="Note for the manufacturer"
            hint={
              choice === 'drop_part'
                ? 'Required: say what should happen to the gap.'
                : 'Optional.'
            }
          >
            <Textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Anything the shop floor needs to know"
            />
          </FormField>

          {error !== null && <Alert tone="danger" title="That answer was not sent">
              {error}
            </Alert>}

          <div className="flex justify-end">
            <Button onClick={answer} loading={pending} disabled={pending}>
              Send the answer
            </Button>
          </div>

          <Text tone="muted" size="xs">
            Production on this part is paused until you answer. Nothing you choose here
            changes the accepted terms: it is recorded as a change against them.
          </Text>
        </>
      ) : (
        <div className="border-t border-border-subtle pt-3">
          <Text tone="muted" size="xs">
            Answered {alert.decidedOn ?? '—'}
          </Text>
          {alert.decisionNote !== null && (
            <Text size="sm" className="mt-1">
              “{alert.decisionNote}”
            </Text>
          )}
        </div>
      )}
    </Card>
  );
};
