'use client';

import Link from 'next/link';
import { Breadcrumbs, type Crumb } from '@ideeza/ui';

/**
 * Client wrapper for the breadcrumb trail, for the same reason as the hub tabs:
 * the link component is a function, which cannot be handed from a server
 * component to a client one.
 */
export const Crumbs = ({ items }: { readonly items: readonly Crumb[] }) => (
  <Breadcrumbs
    items={items}
    linkComponent={({ href, className, children }) => (
      <Link href={href} className={className}>
        {children}
      </Link>
    )}
  />
);
