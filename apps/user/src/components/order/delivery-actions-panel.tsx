'use client';

import { useState } from 'react';
import { Button, Card, CardHeader, StatusChip, Text } from '@ideeza/ui';
import { ReviewModal } from './review-modal.js';

export interface DeliveryPanelProps {
  readonly orderId: string;
  readonly manufacturerName: string;
  readonly reviewed: boolean;
  readonly canReview: boolean;
  readonly reviewBlockedReason: string | null;
  readonly review: {
    readonly rating: number;
    readonly body: string | null;
    readonly anonymous: boolean;
    readonly publishedOn: string;
  } | null;
}

/**
 * The review side of a delivered order.
 *
 * The review is separate from confirming delivery on purpose: confirming moves
 * money and is a decision about the goods, while a review is about the
 * manufacturer. Doing one never implies the other.
 */
export const DeliveryActionsPanel = ({
  orderId,
  manufacturerName,
  reviewed,
  canReview,
  reviewBlockedReason,
  review,
}: DeliveryPanelProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        title="Your review"
        description={`How ${manufacturerName} did on this order.`}
      />

      {reviewed && review !== null ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-brand">
              {'★'.repeat(review.rating)}
              {'☆'.repeat(5 - review.rating)}
            </span>
            <Text tone="muted" size="xs">
              {review.rating} of 5 · published {review.publishedOn}
              {review.anonymous ? ' · anonymous' : ''}
            </Text>
          </div>
          {review.body !== null && <Text size="sm">“{review.body}”</Text>}
          <StatusChip status="completed" label="Review published" />
        </div>
      ) : canReview ? (
        <div className="mt-3 flex flex-col gap-2">
          <Text size="sm">
            One review per order. It updates the manufacturer&rsquo;s public rating, so
            it is worth being specific.
          </Text>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Leave a review
          </Button>
        </div>
      ) : (
        <Text tone="muted" size="sm" className="mt-3">
          {reviewBlockedReason ?? 'A review can be left once the units are delivered.'}
        </Text>
      )}

      <ReviewModal
        orderId={orderId}
        manufacturerName={manufacturerName}
        open={open}
        onClose={() => setOpen(false)}
      />
    </Card>
  );
};
