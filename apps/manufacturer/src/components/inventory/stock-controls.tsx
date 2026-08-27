'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  Select,
  Text,
  Textarea,
  useToast,
} from '@ideeza/ui';
import {
  deletePartAction,
  updatePriceAction,
  updateStockAction,
} from '@/app/(app)/inventory/actions.js';
import { goTo } from '@/lib/navigate.js';

export interface StockControlsProps {
  readonly partId: string;
  readonly partName: string;
  readonly currency: string;
  readonly stockQuantity: number;
  readonly reservedQuantity: number;
  readonly unitPriceMajor: string;
  readonly deletable: boolean;
  readonly undeletableReason: string | null;
  /** Rendered as menu-style buttons in a row, as the design's row menu does. */
  readonly compact?: boolean;
}

const MOVEMENTS = [
  { value: 'stock_in', label: 'Stock in — parts arrived' },
  { value: 'stock_out', label: 'Stock out — parts used or scrapped' },
  { value: 'stock_count', label: 'Count — what the shelf actually holds' },
];

/**
 * The three things that change a part's numbers, each recorded.
 *
 * Stock moves by an amount, or a count says what the shelf really holds. A price
 * change keeps the old price in the history, because quotes already sent were
 * priced from it. Deleting is only offered when nothing depends on the part, and
 * the reason is shown when it is not.
 */
export const StockControls = ({
  partId,
  partName,
  currency,
  stockQuantity,
  reservedQuantity,
  unitPriceMajor,
  deletable,
  undeletableReason,
  compact = false,
}: StockControlsProps) => {
  const [stockOpen, setStockOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  const [kind, setKind] = useState('stock_in');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [price, setPrice] = useState(unitPriceMajor);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [priceNote, setPriceNote] = useState('');

  const router = useRouter();
  const { push } = useToast();

  useEffect(() => setHydrated(true), []);

  const available = Math.max(0, stockQuantity - reservedQuantity);

  const saveStock = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await updateStockAction({ partId, kind, quantity, note });
      if (result.partId === undefined) {
        setError(result.error ?? 'That movement was not recorded.');
        return;
      }
      setStockOpen(false);
      setQuantity('');
      setNote('');
      push({
        title: 'Stock updated',
        body: 'The movement is on the part’s history with what it was and what it is now.',
        tone: 'success',
      });
      router.refresh();
    });
  };

  const savePrice = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await updatePriceAction({
        partId,
        unitPriceMajor: price,
        effectiveFrom,
        note: priceNote,
      });
      if (result.partId === undefined) {
        setError(result.error ?? 'That price was not saved.');
        return;
      }
      setPriceOpen(false);
      setPriceNote('');
      push({
        title: 'Price updated',
        body: 'The old price stays on the history: quotes already sent were priced from it.',
        tone: 'success',
      });
      router.refresh();
    });
  };

  const remove = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await deletePartAction(partId);
      if (result.partId === undefined) {
        setError(result.error ?? 'That part was not deleted.');
        return;
      }
      setDeleteOpen(false);
      push({
        title: 'Part deleted',
        body: `${partName} is no longer in your inventory.`,
        tone: 'info',
      });
      goTo(router, '/inventory?deleted=1');
    });
  };

  return (
    <>
      <div className={compact ? 'flex flex-wrap gap-2' : 'flex flex-wrap gap-2'}>
        <Button variant="secondary" size="sm" onClick={() => setStockOpen(true)}>
          Update stock
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setPriceOpen(true)}>
          Update price
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteOpen(true)}
          title={undeletableReason ?? undefined}
        >
          Delete
        </Button>
      </div>

      <Modal
        open={stockOpen}
        onClose={() => setStockOpen(false)}
        title="Update stock"
        description={`${stockQuantity} on the shelf · ${reservedQuantity} reserved · ${available} available`}
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setStockOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={saveStock}
            >
              Record the movement
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="What happened" required>
            <Select
              options={MOVEMENTS}
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            />
          </FormField>
          <FormField
            label={kind === 'stock_count' ? 'Counted quantity' : 'Quantity'}
            required
            hint={
              kind === 'stock_count'
                ? 'The total on the shelf, not the difference.'
                : 'How many parts moved.'
            }
          >
            <Input
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </FormField>
          <FormField label="Note" hint="Optional. A delivery number, a scrap reason.">
            <Textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>
          {reservedQuantity > 0 && (
            <Alert tone="info" title="Some of this stock is promised">
              {reservedQuantity} parts are reserved for confirmed orders. They cannot be
              taken out or counted away without releasing the order first.
            </Alert>
          )}
          {error !== undefined && (
            <Text tone="danger" size="sm">
              {error}
            </Text>
          )}
        </div>
      </Modal>

      <Modal
        open={priceOpen}
        onClose={() => setPriceOpen(false)}
        title="Update price"
        description={`Currently ${currency} ${unitPriceMajor} per unit.`}
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setPriceOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={savePrice}
            >
              Save the new price
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label={`Price per unit (${currency})`} required>
            <Input
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </FormField>
          <FormField
            label="Effective from"
            hint="Optional. What it is for, not when it takes effect here — the new price is used from now."
          >
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </FormField>
          <FormField label="Note" hint="Optional. A supplier quote, a currency move.">
            <Textarea
              rows={2}
              value={priceNote}
              onChange={(event) => setPriceNote(event.target.value)}
            />
          </FormField>
          <Alert tone="info" title="Quotes already sent do not change">
            A quote is priced when it is written. The old price stays on this
            part&rsquo;s history so you can see what your costing was at the time.
          </Alert>
          {error !== undefined && (
            <Text tone="danger" size="sm">
              {error}
            </Text>
          )}
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={deletable ? 'Delete this part?' : 'This part cannot be deleted'}
        description={
          deletable
            ? 'It has no history to keep, so it can go.'
            : 'Something on the record points at it.'
        }
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              {deletable ? 'Keep it' : 'Close'}
            </Button>
            {deletable && (
              <Button
                variant="danger"
                loading={pending || !hydrated}
                disabled={!hydrated}
                onClick={remove}
              >
                Delete
              </Button>
            )}
          </div>
        }
      >
        <Text>
          {deletable
            ? `${partName} will be removed from your inventory along with its opening count.`
            : (undeletableReason ??
              'Switch it off for order matching instead: it stops being offered without erasing what happened.')}
        </Text>
        {error !== undefined && (
          <Text tone="danger" size="sm" className="mt-3 block">
            {error}
          </Text>
        )}
      </Modal>
    </>
  );
};
