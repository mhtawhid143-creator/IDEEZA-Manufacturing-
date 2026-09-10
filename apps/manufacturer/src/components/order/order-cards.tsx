'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Card, Text, cn } from '@ideeza/ui';
import { counted } from '@ideeza/domain';

export interface OrderCardsProps {
  readonly total: number;
  readonly inFlight: number;
  readonly dueOrLate: number;
  readonly late: number;
  readonly inTrouble: number;
  readonly awaitingFunding: number;
  readonly completed: number;
  readonly dueSoonDays: number;
}

/**
 * The four decisions this page is read for, and the filter itself (UIUX-203).
 *
 * The cards it replaced were retrospective — a total, a count of what had
 * finished — which is the shape a Quotes page wants and not this one. A shop
 * opens Orders to find out what to do today: what is running, what is running
 * out of time, what is waiting on an answer from them, and what has not been
 * paid for and therefore cannot be started.
 *
 * Pressing a card *is* the filter, as on the Quotes page, and each count is the
 * same predicate the table filters by — `matchesView` in the data layer — so a
 * card reading six cannot show four rows.
 *
 * "Due or overdue" and "Needing an answer" overlap "In flight" by design: an
 * order can be both running and late. They are drawn as alerts rather than as
 * four buckets so the row cannot be read as numbers that ought to sum; the set
 * that does sum is the status filter's own, where every state is listed.
 */
export const OrderCards = ({
  total,
  inFlight,
  dueOrLate,
  late,
  inTrouble,
  awaitingFunding,
  completed,
  dueSoonDays,
}: OrderCardsProps) => {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get('status') ?? 'all';

  const go = (status: string): void => {
    const next = new URLSearchParams(params.toString());
    if (status === active) next.delete('status');
    else next.set('status', status);
    next.delete('page');
    const query = next.toString();
    router.push(query === '' ? '/orders' : `/orders?${query}`);
  };

  const cards = [
    {
      status: 'in_production',
      value: String(inFlight),
      label: 'In flight',
      note:
        total === 0
          ? 'Nothing has been ordered yet'
          : `of ${counted(total, 'order')} · ${completed} finished`,
      alert: false,
    },
    {
      status: 'due',
      value: String(dueOrLate),
      label: 'Due or overdue',
      note:
        dueOrLate === 0
          ? `Nothing ships inside ${dueSoonDays} days`
          : late === 0
            ? `All inside ${dueSoonDays} days · none past the date yet`
            : `${late} past the date you quoted`,
      alert: dueOrLate > 0,
    },
    {
      status: 'attention',
      value: String(inTrouble),
      label: 'Needing an answer',
      note:
        inTrouble === 0
          ? 'No cases and no shortages open'
          : 'Cancellations, refunds, disputes and part shortages',
      alert: inTrouble > 0,
    },
    {
      status: 'unfunded',
      value: String(awaitingFunding),
      label: 'Not funded yet',
      note:
        awaitingFunding === 0
          ? 'Everything ordered is paid for'
          : 'No stage moves until IDEEZA holds the money',
      alert: false,
    },
  ];

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      role="group"
      aria-label="Order counts, and the filter"
    >
      {cards.map((card) => {
        const selected = active === card.status;
        return (
          <Card
            key={card.label}
            className={cn(
              card.alert ? 'border-1.5 border-border-warning bg-bg-warning-subtle' : '',
              selected ? 'border-1.5 border-border-brand' : '',
              'p-0',
            )}
          >
            {/*
              The hint is pushed to the bottom of the card rather than left to
              follow the note. A one-line note and a two-line note put it at two
              different heights, and four cards whose last line does not share a
              baseline read as a ragged row rather than as one row.
            */}
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => go(card.status)}
              className="flex h-full w-full flex-col rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
            >
              <p
                data-numeric
                className="text-3xl font-semibold tracking-near text-text-primary"
              >
                {card.value}
              </p>
              <Text size="sm" className="mt-0.5 block font-medium text-text-secondary">
                {card.label}
              </Text>
              <Text tone="muted" size="xs" className="mt-0.5 block">
                {card.note}
              </Text>
              <Text tone="muted" size="xs" className="mt-auto block pt-3">
                {selected ? 'Filtering the table · press to clear' : 'Press to filter'}
              </Text>
            </button>
          </Card>
        );
      })}
    </div>
  );
};
