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
import type { Tone } from './badge.js';

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
  neutral: 'bg-neutral',
  brand: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

const CHIP: Record<Tone, string> = {
  neutral: 'bg-neutral-weak text-neutral',
  brand: 'bg-brand-weak text-brand',
  success: 'bg-success-weak text-success',
  warning: 'bg-warning-weak text-warning-ink',
  danger: 'bg-danger-weak text-danger-strong',
  info: 'bg-info-weak text-info',
};

export interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  readonly status: string;
  readonly withDot?: boolean;
  /** Overrides the label while keeping the tone mapping. */
  readonly label?: string;
}

export const StatusChip = ({
  status,
  withDot = false,
  label,
  className,
  ...rest
}: StatusChipProps) => {
  const presentation = statusPresentation(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        CHIP[presentation.tone],
        className,
      )}
      {...rest}
    >
      {withDot && <span className={cn('h-1.5 w-1.5 rounded-full', DOT[presentation.tone])} />}
      {label ?? presentation.label}
    </span>
  );
};

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: Tone;
  readonly label: string;
}

export const StatusDot = ({ tone = 'neutral', label, className, ...rest }: StatusDotProps) => (
  <span className={cn('inline-flex items-center gap-2 text-sm text-body', className)} {...rest}>
    <span className={cn('h-2 w-2 rounded-full', DOT[tone])} aria-hidden />
    {label}
  </span>
);
