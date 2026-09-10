'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Card, Text, cn } from '@ideeza/ui';
import { counted } from '@ideeza/domain';

export interface QuoteCardsProps {
  readonly currency: string;
  readonly openCount: number;
  readonly openValueMajor: string;
  readonly expiringSoon: number;
  readonly requiringAction: number;
  readonly revisionRequested: number;
  readonly acceptedCount: number;
  readonly wonValueMajor: string;
  /** Null when nothing has been decided yet, which is not a rate of zero. */
  readonly winRate: number | null;
  readonly decided: number;
}

/**
 * The four decisions this page is read for (UIUX-179), and the status filter
 * itself (UIUX-180).
 *
 * One card per status could never work: four slots against five states is an
 * arbitrary subset, and the subset that matters is what a shop can act on. So
 * the row reads left to right as the post-submission funnel — what is open,
 * what is waiting on you, what you won, how often you win.
 *
 * Pressing a card *is* the filter. There used to be a dropdown a few pixels
 * below saying the same thing, so a shop reading "12 accepted" had to ignore
 * the number and go find a control to see the twelve. The dropdown is gone.
 *
 * "Requiring action" counts a subset of "Quoted" and therefore double-counts by
 * design. It is drawn as an alert rather than a fourth bucket so the row cannot
 * be read as four numbers that ought to sum — the set that does sum is in the
 * status filter's own counts, where every state is listed.
 */
export const QuoteCards = ({
  currency,
  openCount,
  openValueMajor,
  expiringSoon,
  requiringAction,
  revisionRequested,
  acceptedCount,
  wonValueMajor,
  winRate,
  decided,
}: QuoteCardsProps) => {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get('status') ?? 'all';

  const go = (status: string): void => {
    const next = new URLSearchParams(params.toString());
    if (status === active || status === 'all') next.delete('status');
    else next.set('status', status);
    next.delete('page');
    const query = next.toString();
    router.push(query === '' ? '/quotes' : `/quotes?${query}`);
  };

  const cards = [
    {
      status: 'quoted',
      value: String(openCount),
      label: 'Quoted',
      note:
        expiringSoon === 0
          ? `${currency} ${openValueMajor} open · none expiring soon`
          : `${currency} ${openValueMajor} open · ${counted(expiringSoon, 'quote')} expiring soon`,
      alert: false,
    },
    {
      status: 'action',
      value: String(requiringAction),
      label: 'Requiring action',
      note:
        requiringAction === 0
          ? 'Nothing is waiting on you'
          : `${revisionRequested} revision asked for · ${
              requiringAction - revisionRequested
            } expiring`,
      alert: true,
    },
    {
      status: 'accepted',
      value: String(acceptedCount),
      label: 'Accepted',
      note: `${currency} ${wonValueMajor} won`,
      alert: false,
    },
    {
      status: 'all',
      value: winRate === null ? '—' : `${Math.round(winRate * 100)}%`,
      label: 'Quote win rate',
      // Decided, not submitted: a quote still with the buyer is silence rather
      // than a loss, so counting it against the shop would understate the rate.
      note:
        decided === 0
          ? 'No quote has been decided yet'
          : `of ${counted(decided, 'decided quote')}`,
      alert: false,
    },
  ];

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      role="group"
      aria-label="Quote counts, and the filter"
    >
      {cards.map((card) => {
        const selected = card.status !== 'all' && active === card.status;
        const pressable = card.status !== 'all';
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
              The last line of every card sits on one baseline: a one-line note
              and a two-line note otherwise put the hint at two heights, and
              four cards that do not agree read as a ragged row.
            */}
            {pressable ? (
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
            ) : (
              <div className="p-4">
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
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};
