'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Modal,
  Select,
  StatusChip,
  Text,
  Textarea,
  Tooltip,
  useToast,
} from '@ideeza/ui';
import { saveSuggestionsAction } from '@/app/(app)/rfqs/actions.js';

export interface CandidateOption {
  readonly inventoryItemId: string;
  readonly label: string;
  readonly detail: string;
}

export interface ShortLine {
  readonly rfqItemId: string;
  readonly reference: string;
  readonly componentName: string;
  readonly sku: string | null;
  readonly requiredTotal: number;
  readonly coverage: 'short' | 'missing';
  readonly shortfall: number;
  readonly candidates: readonly CandidateOption[];
  readonly suggestion: {
    readonly status: 'proposed' | 'approved' | 'rejected';
    readonly inventoryItemId: string | null;
    readonly suggestedPartName: string;
    readonly justification: string;
    readonly impact: string;
  } | null;
}

export interface MissingPartsProps {
  readonly rfqId: string;
  readonly lines: readonly ShortLine[];
  readonly substitutionsAllowed: boolean;
  readonly policyLabel: string;
  readonly unanswered: number;
  readonly quoteSent: boolean;
}

interface RowState {
  readonly inventoryItemId: string;
  readonly note: string;
  readonly noteOpen: boolean;
}

const initialState = (lines: readonly ShortLine[]): Record<string, RowState> =>
  Object.fromEntries(
    lines.map((line) => [
      line.rfqItemId,
      {
        inventoryItemId: line.suggestion?.inventoryItemId ?? '',
        note: line.suggestion?.justification ?? '',
        noteOpen: false,
      },
    ]),
  );

/**
 * The shortage, and the only thing a shop may do about it: suggest.
 *
 * A substitute is never decided here. The buyer approves or rejects it, and
 * until they do the platform will not let the quote be accepted — so what this
 * screen collects is a suggestion the buyer can judge: which part stands in, and
 * why it can.
 *
 * The note is required because the buyer's engineer reads it. The price and
 * lead-time impact are not typed in: they are computed from this shop's own
 * inventory costs, so the number the buyer sees is the difference the stock
 * actually implies.
 */
export const MissingParts = ({
  rfqId,
  lines,
  substitutionsAllowed,
  policyLabel,
  unanswered,
  quoteSent,
}: MissingPartsProps) => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>(() => initialState(lines));
  const [error, setError] = useState<string | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  useEffect(() => setHydrated(true), []);
  useEffect(() => setRows(initialState(lines)), [lines]);

  const set = (id: string, change: Partial<RowState>): void => {
    setRows((current) => ({
      ...current,
      [id]: { ...(current[id] ?? { inventoryItemId: '', note: '', noteOpen: false }), ...change },
    }));
  };

  const chosen = lines.filter(
    (line) => (rows[line.rfqItemId]?.inventoryItemId ?? '') !== '',
  );
  const everythingAnswered = chosen.length === lines.length;

  const save = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await saveSuggestionsAction(
        rfqId,
        lines.map((line) => ({
          rfqItemId: line.rfqItemId,
          inventoryItemId:
            (rows[line.rfqItemId]?.inventoryItemId ?? '') === ''
              ? null
              : (rows[line.rfqItemId]?.inventoryItemId ?? null),
          justification: rows[line.rfqItemId]?.note ?? '',
        })),
      );

      if (!result.saved) {
        setError(result.error ?? 'Those suggestions were not saved.');
        return;
      }
      push({
        title: 'Substitute suggestions saved',
        body: 'They travel with your quote, and the buyer decides on each one.',
        tone: 'success',
      });
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Alert
        tone="danger"
        title="Inventory check required before quoting"
        actions={
          quoteSent ? undefined : (
            <Button variant="primary" onClick={() => setOpen(true)}>
              Manage substitute
            </Button>
          )
        }
      >
        {lines.length} {lines.length === 1 ? 'component' : 'components'}{' '}
        {lines.length === 1 ? 'needs' : 'need'} a substitute suggestion, and the buyer has
        to approve each one before production can start.
        <span className="mt-1 block font-medium text-text-primary">
          {lines
            .map((line, index) => `(${index + 1}) ${line.componentName}`)
            .join('  ')}
        </span>
        {unanswered === 0 && (
          <span className="mt-1 block">
            All of them have a suggestion. The buyer decides when your quote arrives.
          </span>
        )}
      </Alert>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Missing parts"
        description={`Priced for ${lines[0]?.requiredTotal ?? 0} or more parts per line. ${policyLabel}`}
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated || !substitutionsAllowed}
              onClick={save}
            >
              {everythingAnswered ? 'Save all substitutes' : 'Save substitutes'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {!substitutionsAllowed && (
            <Alert tone="warning" title="This request does not allow substitutions">
              The buyer specified the parts exactly. Either source them as specified, or
              decline the request saying the parts cannot be sourced — suggesting a
              substitute here would not be an answer they can accept.
            </Alert>
          )}

          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Parts this shop cannot cover from stock
              </caption>
              <thead>
                <tr className="border-b border-border-subtle bg-bg-surface-raised">
                  {['Qty', 'Missing part', 'Substitute', 'Action'].map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-caps text-text-tertiary"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const row = rows[line.rfqItemId];
                  const noteWritten = (row?.note ?? '').trim() !== '';
                  return (
                    <tr
                      key={line.rfqItemId}
                      className="border-b border-border-subtle align-top last:border-0"
                    >
                      <td className="whitespace-nowrap px-3 py-3 text-text-secondary">
                        {line.requiredTotal} pcs
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-text-primary">{line.componentName}</p>
                        <Text tone="muted" size="xs">
                          {line.reference}
                          {line.sku === null ? '' : ` · ${line.sku}`} ·{' '}
                          {line.coverage === 'missing'
                            ? 'not in your inventory'
                            : `short by ${line.shortfall}`}
                        </Text>
                        {line.suggestion !== null && (
                          <div className="mt-1">
                            <StatusChip
                              status={line.suggestion.status}
                              label={
                                line.suggestion.status === 'proposed'
                                  ? 'Suggested to the buyer'
                                  : line.suggestion.status === 'approved'
                                    ? 'Buyer approved'
                                    : 'Buyer rejected'
                              }
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {line.candidates.length === 0 ? (
                          <Text tone="muted" size="xs">
                            Nothing in your inventory covers {line.requiredTotal} of these.
                          </Text>
                        ) : (
                          <>
                            <Select
                              aria-label={`Substitute for ${line.componentName}`}
                              options={line.candidates.map((candidate) => ({
                                value: candidate.inventoryItemId,
                                label: candidate.label,
                              }))}
                              placeholder="Select substitute"
                              value={row?.inventoryItemId ?? ''}
                              disabled={!substitutionsAllowed || quoteSent}
                              onChange={(event) =>
                                set(line.rfqItemId, { inventoryItemId: event.target.value })
                              }
                            />
                            {(row?.inventoryItemId ?? '') !== '' && (
                              <Text tone="muted" size="xs" className="mt-1 block">
                                {line.candidates.find(
                                  (candidate) =>
                                    candidate.inventoryItemId === row?.inventoryItemId,
                                )?.detail ?? ''}
                              </Text>
                            )}
                            {line.suggestion !== null && (
                              <Text tone="muted" size="xs" className="mt-1 block">
                                {line.suggestion.impact}
                              </Text>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Tooltip
                          content={
                            noteWritten
                              ? 'The buyer reads this reason'
                              : 'Required: why this part can stand in'
                          }
                        >
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={quoteSent}
                            onClick={() =>
                              set(line.rfqItemId, { noteOpen: !(row?.noteOpen ?? false) })
                            }
                          >
                            {noteWritten ? 'View note' : 'Add note'}
                          </Button>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {lines.map((line) =>
            rows[line.rfqItemId]?.noteOpen === true ? (
              <div
                key={`note-${line.rfqItemId}`}
                className="rounded-lg border border-border-subtle bg-bg-surface-raised p-3"
              >
                <p className="text-sm font-semibold text-text-primary">
                  Why this stands in for {line.componentName}
                </p>
                <Text tone="muted" size="xs" className="mt-0.5 block">
                  The buyer&rsquo;s engineer judges the part on this. Package, ratings,
                  and anything the change affects.
                </Text>
                <Textarea
                  className="mt-2"
                  rows={3}
                  aria-label={`Note for ${line.componentName}`}
                  value={rows[line.rfqItemId]?.note ?? ''}
                  disabled={quoteSent}
                  onChange={(event) =>
                    set(line.rfqItemId, { note: event.target.value })
                  }
                />
              </div>
            ) : null,
          )}

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
