import type { HTMLAttributes } from 'react';
import type {
  OrderStatus,
  PaymentStatus,
  PayoutStatus,
  ProductionProgressStatus,
  QuoteStatus,
  RfqRecipientStatus,
  RfqStatus,
} from '@ideeza/domain';
import { cn } from '../lib/cn.js';
import { badgeToneOverride, type Tone } from './badge.js';
import { Badge as DsBadge } from '@ideeza/ds';

export type DomainStatus =
  | RfqStatus
  | RfqRecipientStatus
  | QuoteStatus
  | OrderStatus
  | PaymentStatus
  | PayoutStatus
  | ProductionProgressStatus;

/**
 * One place that turns a domain status into a label and a tone.
 *
 * The labels are the approved vocabulary, not the words in the design file: an
 * order that has not been funded reads "Awaiting payment", never "Accepted",
 * because an accepted quote is not a confirmed order.
 */
const STATUS_PRESENTATION: Readonly<Record<string, { label: string; tone: Tone }>> = {
  // request
  // Product availability, which decides whether manufacturing can start.
  available: { label: 'Available', tone: 'success' },
  unavailable: { label: 'Currently unavailable', tone: 'neutral' },

  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Submitted', tone: 'info' },
  closed: { label: 'Closed', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
  // routing record
  routed: { label: 'Sent', tone: 'info' },
  viewed: { label: 'Viewed', tone: 'info' },
  quoted: { label: 'Quote received', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
  expired: { label: 'Expired', tone: 'neutral' },
  // quote
  revision_requested: { label: 'Revision requested', tone: 'warning' },
  revised: { label: 'Revised', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'brand' },
  rejected: { label: 'Rejected', tone: 'danger' },
  // order
  awaiting_payment: { label: 'Awaiting payment', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'brand' },
  in_production: { label: 'In production', tone: 'info' },
  quality_check: { label: 'Quality check', tone: 'info' },
  ready_to_ship: { label: 'Ready to ship', tone: 'info' },
  shipped: { label: 'Shipped', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'success' },
  completed: { label: 'Completed', tone: 'success' },
  cancel_requested: { label: 'Cancellation requested', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  refund_requested: { label: 'Refund requested', tone: 'warning' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  partially_refunded: { label: 'Partially refunded', tone: 'warning' },
  disputed: { label: 'Disputed', tone: 'danger' },
  resolved: { label: 'Resolved', tone: 'success' },
  // money
  initiated: { label: 'Payment started', tone: 'warning' },
  secured: { label: 'Payment secured', tone: 'success' },
  released: { label: 'Released', tone: 'success' },
  pending_release: { label: 'Pending release', tone: 'warning' },
  // production progress
  pending: { label: 'Pending', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'info' },
  // a dispute that is live, and a shortage that has not been answered: the
  // shortage card overrides the label, because there the word means "your turn"
  open: { label: 'Open', tone: 'warning' },
  responded: { label: 'Responded', tone: 'info' },
  under_review: { label: 'Under review', tone: 'info' },
  escalated: { label: 'Escalated', tone: 'danger' },
  mfr_responded: { label: 'Manufacturer answered', tone: 'info' },
  ops_review: { label: 'With IDEEZA', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  partial: { label: 'Partly approved', tone: 'warning' },
  substitute_approved: { label: 'Substitute approved', tone: 'success' },
  part_dropped: { label: 'Part dropped', tone: 'neutral' },
  stock_awaited: { label: 'Waiting for stock', tone: 'warning' },
};

export const statusPresentation = (
  status: string,
): { readonly label: string; readonly tone: Tone } =>
  STATUS_PRESENTATION[status] ?? { label: status.replace(/_/g, ' '), tone: 'neutral' };

const DOT: Record<Tone, string> = {
  neutral: 'bg-icon',
  brand: 'bg-bg-brand',
  success: 'bg-bg-success',
  warning: 'bg-bg-warning',
  danger: 'bg-bg-error',
  info: 'bg-bg-info',
};

/**
 * This repository's tone names in the system's colour names — the same two-word
 * translation `Badge` makes: `danger` is the system's `error`, `info` its
 * `blue`. The classes that used to live here are gone; the system's badge paints
 * itself now, so there is one place that knows what a warning looks like.
 */
const BADGE_COLOUR: Record<Tone, 'neutral' | 'brand' | 'blue' | 'success' | 'warning' | 'error'> = {
  neutral: 'neutral',
  brand: 'brand',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'blue',
};

// `color` is dropped from the span's own attributes. HTML has a legacy `color`
// attribute, so leaving it in means the caller's spread lands after the tone
// this component chose and silently replaces it with a plain string — which is
// how the system's badge lost its colour the first time.
export interface StatusChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  readonly status: string;
  readonly withDot?: boolean;
  /** Overrides the label while keeping the tone mapping. */
  readonly label?: string;
}

/**
 * A status, as the system's A17 Badge in its Subtle style.
 *
 * The pill is the system's own component — heights, padding, radius, type face
 * and the six tones' colours all come from there, including the leading dot,
 * which the system draws at 6px from the tone's own solid colour. Nothing about
 * how it looks is decided here; what is decided here is which tone a status
 * carries, which is the table above and is this repository's business.
 */
export const StatusChip = ({
  status,
  withDot = false,
  label,
  className,
  ...rest
}: StatusChipProps) => {
  const presentation = statusPresentation(status);
  return (
    <DsBadge
      variant="subtle"
      color={BADGE_COLOUR[presentation.tone] ?? 'neutral'}
      size="md"
      dot={withDot}
      className={cn(badgeToneOverride(presentation.tone), className)}
      {...rest}
    >
      {label ?? presentation.label}
    </DsBadge>
  );
};

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: Tone;
  readonly label: string;
}

export const StatusDot = ({ tone = 'neutral', label, className, ...rest }: StatusDotProps) => (
  <span className={cn('inline-flex items-center gap-2 text-sm text-text-secondary', className)} {...rest}>
    <span className={cn('h-2 w-2 rounded-full', DOT[tone])} aria-hidden />
    {label}
  </span>
);
