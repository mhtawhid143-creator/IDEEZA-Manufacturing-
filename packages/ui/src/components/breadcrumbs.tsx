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

/**
 * The "Draft / Select manufacture / Request Quote" trail from the Figma flows.
 * M19 Breadcrumb sets every crumb in 14 regular tertiary with a plain "/"
 * between them; only the current page is medium and primary.
 */
export const Breadcrumbs = ({ items, className, linkComponent }: BreadcrumbsProps) => (
  <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {items.map((crumb, index) => {
        const isLast = index === items.length - 1;
        const link =
          crumb.href !== undefined && !isLast && linkComponent !== undefined
            ? linkComponent({
                href: crumb.href,
                className:
                  'text-text-tertiary transition-colors duration-fast hover:text-text-brand hover:underline',
                children: crumb.label,
              })
            : null;

        return (
          <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
            {link ??
              (isLast ? (
                <span aria-current="page" className="font-medium text-text-primary">
                  {crumb.label}
                </span>
              ) : (
                <span className="text-text-tertiary">{crumb.label}</span>
              ))}
            {!isLast && (
              <span aria-hidden className="text-text-tertiary">
                /
              </span>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
