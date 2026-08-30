import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import type { Tone } from './badge.js';

export interface AlertProps {
  readonly tone?: Extract<Tone, 'info' | 'warning' | 'danger' | 'success' | 'brand'>;
  readonly title: string;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
}

const TONE = {
  info: 'border-border-blue/30 bg-blue-100 text-text-link',
  warning: 'border-border-warning/40 bg-yellow-100 text-text-warning',
  danger: 'border-border-error/40 bg-red-100 text-red-700',
  success: 'border-border-success/30 bg-green-100 text-text-success',
  brand: 'border-border-brand/30 bg-bg-brand-subtle text-text-brand',
} as const;

/**
 * The inline banner the Figma flows use for a manufacturer message, for example
 * "Parts Review Required". A danger or warning alert is announced immediately;
 * the rest are polite.
 */
export const Alert = ({ tone = 'info', title, children, actions, className }: AlertProps) => (
  <div
    role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
    className={cn('flex flex-wrap items-start gap-3 rounded-lg border p-4', TONE[tone], className)}
  >
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold">{title}</p>
      {children !== undefined && <div className="ids-measure mt-1 text-sm">{children}</div>}
    </div>
    {actions !== undefined && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);
