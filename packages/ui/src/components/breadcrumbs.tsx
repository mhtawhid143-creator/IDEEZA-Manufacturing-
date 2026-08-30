import type { ReactNode } from 'react';
import { Icon } from './icon.js';
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
                className: 'text-text-secondary hover:text-text-brand hover:underline',
                children: crumb.label,
              })
            : null;

        return (
          <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
            {link ??
              (isLast ? (
                <span aria-current="page" className="font-medium text-text-tertiary underline decoration-line-strong">
                  {crumb.label}
                </span>
              ) : (
                <span className="text-text-secondary">{crumb.label}</span>
              ))}
            {!isLast && (
              <Icon name="chevron-right" size={12} className="text-text-tertiary" />
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
