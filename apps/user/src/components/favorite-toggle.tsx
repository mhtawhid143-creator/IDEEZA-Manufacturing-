'use client';

import { useState, useTransition } from 'react';
import { IconButton, useToast } from '@ideeza/ui';
import { toggleFavoriteAction } from '@/app/(app)/favorites/actions.js';

const HeartIcon = ({ filled }: { readonly filled: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
    <path
      d="M10 17s-6.5-4.1-6.5-8.2A3.8 3.8 0 0 1 10 6.2a3.8 3.8 0 0 1 6.5 2.6C16.5 12.9 10 17 10 17Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

export interface FavoriteToggleProps {
  readonly productId: string;
  readonly productName: string;
  readonly favorite: boolean;
}

/**
 * The like state, written straight to the buyer's favourites.
 *
 * The button carries the state in its label and in aria-pressed, so it is not
 * only a filled or hollow heart.
 */
export const FavoriteToggle = ({
  productId,
  productName,
  favorite,
}: FavoriteToggleProps) => {
  const [kept, setKept] = useState(favorite);
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  const onClick = (): void => {
    startTransition(async () => {
      const previous = kept;
      try {
        const result = await toggleFavoriteAction(productId);
        setKept(result.favorite);
        push({
          title: result.favorite ? 'Kept in favourites' : 'Removed from favourites',
          body: productName,
          tone: result.favorite ? 'success' : 'info',
        });
      } catch {
        setKept(previous);
        push({
          title: 'That did not save',
          body: 'The favourite could not be changed. Try again.',
          tone: 'danger',
        });
      }
    });
  };

  return (
    <IconButton
      label={kept ? `Remove ${productName} from favourites` : `Keep ${productName} in favourites`}
      aria-pressed={kept}
      variant={kept ? 'brand' : 'surface'}
      disabled={pending}
      onClick={onClick}
      icon={<HeartIcon filled={kept} />}
    />
  );
};
