'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Alert, Button, Checkbox, cn, Icon, Modal, Text, Textarea, useToast } from '@ideeza/ui';
import { publishReviewAction } from '@/app/(app)/manufacturing/orders/delivery-actions.js';

export interface ReviewModalProps {
  readonly orderId: string;
  readonly manufacturerName: string;
  readonly open: boolean;
  readonly onClose: () => void;
}

const StarIcon = ({ filled }: { readonly filled: boolean }) => (
  <Icon name="star" size={26} filled={filled} />
);

/**
 * The public review of the manufacturer.
 *
 * A rating on its own is a complete answer, so the note is optional and skipping
 * is a real option rather than a nag. The review is bound to one delivered order,
 * which is what makes the manufacturer's public rating mean something.
 */
export const ReviewModal = ({
  orderId,
  manufacturerName,
  open,
  onClose,
}: ReviewModalProps) => {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (): void => {
    if (rating === 0) {
      setError('Choose a rating from one to five stars.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await publishReviewAction({
        orderId,
        rating,
        ...(body.trim() === '' ? {} : { body: body.trim() }),
        anonymous,
      });
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      push({
        title: 'Review published',
        body:
          result.manufacturerRating === null || result.manufacturerRating === undefined
            ? `${manufacturerName} has your rating.`
            : `${manufacturerName} now shows ★ ${result.manufacturerRating.toFixed(1)}.`,
        tone: 'success',
      });
      onClose();
      router.refresh();
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Public review"
      description="Your review helps other founders choose a manufacturer."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Skip for now
          </Button>
          <Button onClick={submit} loading={pending} disabled={pending}>
            Submit feedback
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">Rate your experience</p>
          <div
            role="radiogroup"
            aria-label="Rating"
            className="mt-2 flex items-center gap-1.5"
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                onClick={() => {
                  setRating(value);
                  setError(null);
                }}
                className={cn(
                  'rounded-md p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
                  value <= rating ? 'text-text-brand' : 'text-border-strong hover:text-text-brand',
                )}
              >
                <StarIcon filled={value <= rating} />
              </button>
            ))}
            {rating > 0 && (
              <Text tone="muted" size="xs" className="ml-2">
                {rating} of 5
              </Text>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor={`review-body-${orderId}`}
            className="text-sm font-semibold text-text-primary"
          >
            Share your experience
          </label>
          <Textarea
            id={`review-body-${orderId}`}
            className="mt-1.5"
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={`What stood out about working with ${manufacturerName}?`}
          />
        </div>

        <Checkbox
          label="Post anonymously"
          description="Your rating still counts; your name is not shown."
          checked={anonymous}
          onChange={(event) => setAnonymous(event.target.checked)}
        />

        {error !== null && (
          <Alert tone="danger" title="That review was not published">
            {error}
          </Alert>
        )}

        <Text tone="muted" size="xs">
          One review per order, published against the order it belongs to. It updates
          the manufacturer&rsquo;s public rating.
        </Text>
      </div>
    </Modal>
  );
};
