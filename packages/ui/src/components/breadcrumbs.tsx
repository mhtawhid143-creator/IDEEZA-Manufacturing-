import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface Crumb {
  readonly label: string;
  readonly href?: string | undefined;
}

export interface BreadcrumbsProps {
  readonly items: readonly Crumb[];
  readonly className?: string;
  readonly linkComponent?: (props: {
    readonly href: string;
    readonly className: string;
    readonly children: ReactNode;
  }) => ReactNode;
}

/** The "Draft > Select manufacture > Request Quote" trail from the Figma flows. */
export const Breadcrumbs = ({ items, className, linkComponent }: BreadcrumbsProps) => (
  <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
    <ol className="flex flex-wrap items-center gap-1.5 text-sm">
      {items.map((crumb, index) => {
        const isLast = index === items.length - 1;
        const link =
          crumb.href !== undefined && !isLast && linkComponent !== undefined
            ? linkComponent({
                href: crumb.href,
                className: 'text-body hover:text-brand hover:underline',
                children: crumb.label,
              })
            : null;

        return (
          <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
            {link ??
              (isLast ? (
                <span aria-current="page" className="font-medium text-muted underline decoration-line-strong">
                  {crumb.label}
                </span>
              ) : (
                <span className="text-body">{crumb.label}</span>
              ))}
            {!isLast && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="text-muted">
                <path d="m4.5 3 3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
