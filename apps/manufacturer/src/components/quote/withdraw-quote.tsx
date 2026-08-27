'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Button, Modal, Text, useToast } from '@ideeza/ui';
import { withdrawQuoteAction } from '@/app/(app)/quotes/actions.js';

export interface WithdrawQuoteProps {
  readonly quoteId: string;
  readonly productName: string;
}

/**
 * Taking a quote off the table.
 *
 * It is not a deletion: the quote stays on the record as withdrawn, because the
 * buyer may have been comparing against it and is entitled to see that it is
 * gone rather than find it missing.
 */
export const WithdrawQuote = ({ quoteId, productName }: WithdrawQuoteProps) => {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  useEffect(() => setHydrated(true), []);

  const withdraw = (): void => {
    startTransition(async () => {
      const result = await withdrawQuoteAction(quoteId);
      if (!result.withdrawn) {
        push({
          title: 'That quote was not withdrawn',
          body: result.error ?? 'Try again.',
          tone: 'danger',
        });
        return;
      }
      setOpen(false);
      push({
        title: 'Quote withdrawn',
        body: `${productName} is no longer on the table for this buyer.`,
        tone: 'info',
      });
      router.refresh();
    });
  };

  return (
    <>
      <Button
        variant="secondary"
        className="w-full justify-center"
        onClick={() => setOpen(true)}
      >
        Withdraw Quote
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Withdraw this quote?"
        description="The buyer can no longer accept it."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep it on the table
            </Button>
            <Button
              variant="danger"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={withdraw}
            >
              Withdraw
            </Button>
          </div>
        }
      >
        <Text>
          Your quote for <span className="font-semibold">{productName}</span> stays on
          the record as withdrawn, so the buyer can see what happened. If you want to
          change the price or the lead time instead, revise it — that keeps you in the
          comparison.
        </Text>
      </Modal>
    </>
  );
};
