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
  info: 'border-info/30 bg-info-weak text-info',
  warning: 'border-warning/40 bg-warning-weak text-[#8a5a00]',
  danger: 'border-danger/40 bg-danger-weak text-danger-strong',
  success: 'border-success/30 bg-success-weak text-success',
  brand: 'border-brand/30 bg-brand-weak text-brand',
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
