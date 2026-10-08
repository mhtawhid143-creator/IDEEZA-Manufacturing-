'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Card, Text, cn } from '@ideeza/ui';
import { STOCK_LEVEL_LABEL } from '@ideeza/domain';

export interface InventoryCardsProps {
  readonly totalSkus: number;
  readonly disabled: number;
  readonly valueMajor: string;
  readonly valueLabel: string;
  readonly lowStock: number;
  readonly outOfStock: number;
  readonly reservedParts: number;
}

/**
 * The five figures this page is read for, and four of them are the filter.
 *
 * They used to be five static cards, and a reviewer pressed "Parts reserved"
 * and nothing happened (UIUX-220). A number that answers "how many" invites the
 * question "which ones", and a card that cannot answer it is a dead end — so
 * each count that names a set of rows now narrows the table to exactly that set.
 *
 * The same contract as the Orders page's cards: the count and the filter are
 * the same predicate, so a card reading six cannot show four rows; pressing the
 * active card clears it; and the pressed state is on the control itself, so a
 * screen reader is told which filter is on.
 *
 * "Stock at cost" stays a plain card. It is money, not a set of rows, and there
 * is nothing to narrow the table to.
 */
export const InventoryCards = ({
  totalSkus,
  disabled,
  valueMajor,
  valueLabel,
  lowStock,
  outOfStock,
  reservedParts,
}: InventoryCardsProps) => {
  const router = useRouter();
  const params = useSearchParams();
  const level = params.get('level') ?? 'all';
  const reserved = params.get('reserved') ?? 'all';

  /**
   * One card, one key, one value. Pressing the card that is already on clears
   * it, which is the only way out of a filter that a card can offer.
   */
  const go = (key: 'level' | 'reserved', value: string, active: boolean): void => {
    const next = new URLSearchParams(params.toString());
    if (active) next.delete(key);
    else next.set(key, value);
    next.delete('page');
    const query = next.toString();
    router.push(query === '' ? '/inventory' : `/inventory?${query}`);
  };

  const clear = (): void => {
    router.push('/inventory');
  };

  const filtering = level !== 'all' || reserved !== 'all';

  const cards = [
    {
      key: 'level' as const,
      value: 'low_stock',
      count: lowStock,
      label: STOCK_LEVEL_LABEL.low_stock,
      note: 'Availability at or below your threshold',
      tone: 'warning' as const,
    },
    {
      key: 'level' as const,
      value: 'out_of_stock',
      count: outOfStock,
      label: STOCK_LEVEL_LABEL.out_of_stock,
      note: 'Nothing free to promise',
      tone: 'danger' as const,
    },
    {
      key: 'reserved' as const,
      value: 'reserved',
      count: reservedParts,
      label: 'Parts reserved',
      note: 'Promised to confirmed orders',
      tone: 'neutral' as const,
    },
  ];

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
      role="group"
      aria-label="Inventory counts, and the filter"
    >
      <Card className={cn('p-0', filtering ? '' : 'border-1.5 border-border-brand')}>
        <button
          type="button"
          aria-pressed={!filtering}
          onClick={clear}
          className="flex h-full w-full flex-col rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
        >
          <p data-numeric className="text-3xl font-semibold tracking-near text-text-primary">
            {totalSkus}
          </p>
          <Text size="sm" className="mt-0.5 block font-medium text-text-secondary">
            Parts held
          </Text>
          <Text tone="muted" size="xs" className="mt-0.5 block">
            {disabled === 0
              ? 'All of them matched to requests'
              : `${disabled} not matched to requests`}
          </Text>
          <Text tone="muted" size="xs" className="mt-auto block pt-3">
            {filtering ? 'Press to show every part' : 'Showing every part'}
          </Text>
        </button>
      </Card>

      {/* Money, not a set of rows — so it is read, not pressed. */}
      <Card>
        <p data-numeric className="text-3xl font-semibold tracking-near text-text-primary">
          {valueLabel} {valueMajor}
        </p>
        <Text size="sm" className="mt-0.5 block font-medium text-text-secondary">
          Stock at cost
        </Text>
        <Text tone="muted" size="xs" className="mt-0.5 block">
          Everything on the shelf, at what you paid
        </Text>
      </Card>

      {cards.map((card) => {
        const active = (card.key === 'level' ? level : reserved) === card.value;
        // A zero is good news on these three, so it is never painted as an
        // alarm — the tone follows the number, not the card.
        const alarmed = card.count > 0 && card.tone !== 'neutral';
        return (
          <Card
            key={card.label}
            className={cn(
              'p-0',
              alarmed && card.tone === 'warning' ? 'border-border-warning' : '',
              alarmed && card.tone === 'danger' ? 'border-border-error' : '',
              active ? 'border-1.5 border-border-brand' : '',
            )}
          >
            <button
              type="button"
              aria-pressed={active}
              onClick={() => go(card.key, card.value, active)}
              className="flex h-full w-full flex-col rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
            >
              <p
                data-numeric
                className={cn(
                  'text-3xl font-semibold tracking-near',
                  alarmed && card.tone === 'warning' ? 'text-text-warning' : '',
                  alarmed && card.tone === 'danger' ? 'text-text-error' : '',
                  alarmed ? '' : 'text-text-primary',
                )}
              >
                {card.count}
              </p>
              <Text size="sm" className="mt-0.5 block font-medium text-text-secondary">
                {card.label}
              </Text>
              <Text tone="muted" size="xs" className="mt-0.5 block">
                {card.note}
              </Text>
              <Text tone="muted" size="xs" className="mt-auto block pt-3">
                {active ? 'Filtering the table · press to clear' : 'Press to filter'}
              </Text>
            </button>
          </Card>
        );
      })}
    </div>
  );
};
