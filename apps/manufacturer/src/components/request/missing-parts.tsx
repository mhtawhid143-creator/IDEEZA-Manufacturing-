'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  Alert,
  Badge,
  Button,
  Modal,
  Select,
  StatusChip,
  Text,
  Textarea,
  Tooltip,
  useToast,
} from '@ideeza/ui';
import { counted } from '@ideeza/domain';
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
    readonly status: 'proposed' | 'approved' | 'rejected' | 'unavailable';
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

/**
 * The shop's answer of last resort, as a value the select can hold (UIUX-162).
 *
 * It is not an inventory id and can never collide with one, because the id
 * scheme is `prefix_base36` and this is neither. Choosing it is a positive act,
 * which is the whole point: an unanswerable line and an unanswered one used to
 * look identical, so the quote could not move and nothing said why.
 */
const NO_SUBSTITUTE = 'no-substitute-available';

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
        inventoryItemId:
          line.suggestion?.status === 'unavailable'
            ? NO_SUBSTITUTE
            : (line.suggestion?.inventoryItemId ?? ''),
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
  const declared = lines.filter(
    (line) => rows[line.rfqItemId]?.inventoryItemId === NO_SUBSTITUTE,
  );
  const everythingAnswered = chosen.length === lines.length;

  const save = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await saveSuggestionsAction(
        rfqId,
        lines.map((line) => {
          const value = rows[line.rfqItemId]?.inventoryItemId ?? '';
          return {
            rfqItemId: line.rfqItemId,
            inventoryItemId: value === '' || value === NO_SUBSTITUTE ? null : value,
            justification: rows[line.rfqItemId]?.note ?? '',
            unavailable: value === NO_SUBSTITUTE,
          };
        }),
      );

      if (!result.saved) {
        setError(result.error ?? 'Those suggestions were not saved.');
        return;
      }
      push({
        title: 'Substitute suggestions saved',
        body:
          declared.length === 0
            ? 'They travel with your quote, and the buyer decides on each one.'
            : `${counted(declared.length, 'part')} ${
                declared.length === 1 ? 'is' : 'are'
              } marked as one you cannot source. Your quote can still go out, and the buyer decides what to do about the gap.`,
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
              Manage substitutes
            </Button>
          )
        }
      >
        {counted(lines.length, 'component')} {lines.length === 1 ? 'needs' : 'need'} a
        substitute suggestion, and the buyer has to approve each one before production
        can start.
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

      {/*
        The dialog is named after the button that opens it (UIUX-159). It read
        "Missing parts" while the control said "Manage substitute", so a shop
        arrived somewhere that looked like a different screen from the one it
        had asked for.
      */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Manage substitutes"
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
          {/*
            How many are answered, and what happens to the rest (UIUX-160).
            Saving does not require every line — a shop can answer what it can
            and come back — so the honest thing is a count and the consequence,
            not a gate with no stated reason.
          */}
          {substitutionsAllowed && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-surface-raised px-3 py-2">
              <span className="text-sm font-medium text-text-primary" data-numeric>
                {chosen.length} of {lines.length} answered
              </span>
              <Text tone="muted" size="xs">
                {declared.length > 0
                  ? `${counted(declared.length, 'line')} marked as one you cannot source. The quote still goes out with it.`
                  : everythingAnswered
                    ? 'Every line has a substitute. The buyer decides on each one.'
                    : 'A line with no substitute needs one, or the answer that none exists.'}
              </Text>
            </div>
          )}

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
                            {line.suggestion.status === 'unavailable' ? (
                              // Not a suggestion, so not a status the buyer
                              // decides: it is a declaration, and it reads as a
                              // warning because it is the buyer's problem now.
                              <Badge tone="warning">You cannot source this</Badge>
                            ) : (
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
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Select
                          aria-label={`Substitute for ${line.componentName}`}
                          options={[
                            ...line.candidates.map((candidate) => ({
                              value: candidate.inventoryItemId,
                              label: candidate.label,
                            })),
                            { value: NO_SUBSTITUTE, label: 'No substitute available' },
                          ]}
                          placeholder={
                            line.candidates.length === 0
                              ? 'Nothing in your stock covers this'
                              : 'Select substitute'
                          }
                          value={row?.inventoryItemId ?? ''}
                          disabled={!substitutionsAllowed || quoteSent}
                          onChange={(event) =>
                            set(line.rfqItemId, { inventoryItemId: event.target.value })
                          }
                        />
                        {line.candidates.length === 0 && (
                          <Text tone="muted" size="xs" className="mt-1 block">
                            Nothing in your inventory covers {line.requiredTotal} of these.
                          </Text>
                        )}
                        {row?.inventoryItemId === NO_SUBSTITUTE ? (
                          <Text tone="muted" size="xs" className="mt-1 block">
                            The quote still goes out. This line travels with it as a part
                            you cannot supply, and the buyer decides what to do about it.
                          </Text>
                        ) : (
                          (row?.inventoryItemId ?? '') !== '' && (
                            <Text tone="muted" size="xs" className="mt-1 block">
                              {line.candidates.find(
                                (candidate) =>
                                  candidate.inventoryItemId === row?.inventoryItemId,
                              )?.detail ?? ''}
                            </Text>
                          )
                        )}
                        {line.suggestion !== null &&
                          line.suggestion.status !== 'unavailable' && (
                            <Text tone="muted" size="xs" className="mt-1 block">
                              {line.suggestion.impact}
                            </Text>
                          )}
                      </td>
                      <td className="px-3 py-3">
                        <Tooltip
                          content={
                            noteWritten
                              ? 'The buyer reads this reason'
                              : row?.inventoryItemId === NO_SUBSTITUTE
                                ? 'Required: why the part cannot be sourced'
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
                  {rows[line.rfqItemId]?.inventoryItemId === NO_SUBSTITUTE
                    ? `Why ${line.componentName} cannot be sourced`
                    : `Why this stands in for ${line.componentName}`}
                </p>
                <Text tone="muted" size="xs" className="mt-0.5 block">
                  {rows[line.rfqItemId]?.inventoryItemId === NO_SUBSTITUTE
                    ? 'The buyer chooses between waiting, sourcing it themselves and taking the request elsewhere. They choose on this sentence, so say what you know: discontinued, on allocation, nothing equivalent in stock.'
                    : 'The buyer’s engineer judges the part on this. Package, ratings, and anything the change affects.'}
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
