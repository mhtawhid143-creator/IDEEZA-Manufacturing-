'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Modal, Text, useToast } from '@ideeza/ui';
import { withdrawDraftAction } from '@/app/(app)/manufacturing/draft/actions.js';
import { goTo } from '@/lib/navigate.js';

export interface WithdrawDraftProps {
  readonly draftId: string;
  readonly productName: string;
}

/**
 * Dropping a draft is not undoable, so it is confirmed first.
 *
 * The action reports the outcome and this component moves the buyer on, which
 * keeps the toast and the navigation in one place.
 */
export const WithdrawDraft = ({ draftId, productName }: WithdrawDraftProps) => {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  const withdraw = (): void => {
    startTransition(async () => {
      const result = await withdrawDraftAction(draftId);
      if (!result.withdrawn) {
        push({
          title: 'That draft was not withdrawn',
          body: result.error ?? 'Try again.',
          tone: 'danger',
        });
        return;
      }
      setConfirming(false);
      push({
        title: 'Draft withdrawn',
        body: `${productName} can start a new request whenever you are ready.`,
        tone: 'info',
      });
      goTo(router, '/manufacturing?withdrawn=1');
    });
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        Withdraw draft
      </Button>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Withdraw this draft?"
        description="The draft stops being editable and the product is free to start a new request."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep the draft
            </Button>
            <Button variant="danger" loading={pending} onClick={withdraw}>
              Withdraw
            </Button>
          </div>
        }
      >
        <Text>
          The draft for <span className="font-semibold">{productName}</span> has
          not been sent to anyone, so nothing is cancelled and no manufacturer is
          notified.
        </Text>
      </Modal>
    </>
  );
};
