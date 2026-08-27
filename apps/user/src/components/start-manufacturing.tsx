'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  Button,
  Modal,
  StatusChip,
  Text,
  buttonAppearance,
  useToast,
  type ButtonSize,
} from '@ideeza/ui';
import { startManufacturingAction } from '@/app/(app)/favorites/actions.js';
import { goTo } from '@/lib/navigate.js';

interface ExistingRequest {
  readonly rfqId: string;
  readonly status: string;
  readonly href: string;
}

export interface StartManufacturingProps {
  readonly productId: string;
  readonly productName: string;
  readonly available: boolean;
  readonly label?: string;
  readonly size?: ButtonSize;
  readonly fullWidth?: boolean;
}

/**
 * The one control that starts a manufacturing request.
 *
 * The server decides what happens, because the rule belongs to the domain and
 * not to the screen: an unavailable product is refused, a product that already
 * has an open request sends the buyer to that request, and anything else opens
 * a new draft.
 */
export const StartManufacturing = ({
  productId,
  productName,
  available,
  label = 'Start Manufacturing',
  size = 'lg',
  fullWidth = false,
}: StartManufacturingProps) => {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [existing, setExisting] = useState<ExistingRequest | null>(null);

  if (!available) {
    return (
      <Button size={size} fullWidth={fullWidth} disabled>
        Currently unavailable
      </Button>
    );
  }

  const onClick = (): void => {
    startTransition(async () => {
      try {
        const result = await startManufacturingAction(productId);
        if (result.kind === 'unavailable') {
          push({
            title: 'Currently unavailable',
            body: `${result.productName} cannot be sent to manufacture right now.`,
            tone: 'warning',
          });
          return;
        }
        if (result.kind === 'existing-request') {
          setExisting({ rfqId: result.rfqId, status: result.status, href: result.href });
          return;
        }
        push({
          title: 'Manufacturing started',
          body: `A draft request for ${result.productName} is open. Choose the package and the requirements next.`,
          tone: 'success',
        });
        goTo(router, result.href);
      } catch {
        push({
          title: 'That did not start',
          body: 'The request could not be opened. Try again.',
          tone: 'danger',
        });
      }
    });
  };

  return (
    <>
      <Button size={size} fullWidth={fullWidth} loading={pending} onClick={onClick}>
        {label}
      </Button>

      <Modal
        open={existing !== null}
        onClose={() => setExisting(null)}
        title="This product already has an open request"
        description="One open request per product: a second one would collect a second set of quotes for the same thing, and accepting one quote from each would create two orders you did not mean to place."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href="/favorites"
              className={buttonAppearance({ variant: 'secondary' })}
              onClick={() => setExisting(null)}
            >
              Go to Favorites
            </Link>
            <Link
              href={existing?.href ?? '/manufacturing'}
              className={buttonAppearance()}
              onClick={() => setExisting(null)}
            >
              View Request
            </Link>
          </div>
        }
      >
        {existing !== null && (
          <div className="flex flex-col gap-2">
            <Text>
              {productName} is already on request <span className="font-semibold">{existing.rfqId}</span>.
            </Text>
            <div>
              <StatusChip status={existing.status} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
