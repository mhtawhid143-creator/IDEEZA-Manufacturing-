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

// M01 Alert paints the severity into the surface and the border only — the
// subtle status background with its matching border — while the words stay
// text-primary over text-secondary on every tone, which is what keeps a long
// warning readable. Brand keeps the brand-subtle surface, which is what the
// system gives an AI/brand banner.
const TONE = {
  info: 'border-border-blue bg-bg-info-subtle',
  warning: 'border-border-warning bg-bg-warning-subtle',
  danger: 'border-border-error bg-bg-error-subtle',
  success: 'border-border-success bg-bg-success-subtle',
  brand: 'border-border-brand bg-bg-brand-subtle',
} as const;

/**
 * The inline banner the Figma flows use for a manufacturer message, for example
 * "Parts Review Required". A danger or warning alert is announced immediately;
 * the rest are polite.
 */
export const Alert = ({ tone = 'info', title, children, actions, className }: AlertProps) => (
  <div
    role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
    className={cn('flex flex-wrap items-start gap-3 rounded-xl border p-4', TONE[tone], className)}
  >
    <div className="min-w-0 flex-1">
      <p className="text-base font-medium text-text-primary">{title}</p>
      {children !== undefined && (
        <div className="max-w-measure mt-1 text-sm text-text-secondary">{children}</div>
      )}
    </div>
    {actions !== undefined && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);
