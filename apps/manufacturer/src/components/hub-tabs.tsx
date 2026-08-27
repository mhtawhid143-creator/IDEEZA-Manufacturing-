'use client';

import Link from 'next/link';
import { Tabs, type TabItem } from '@ideeza/ui';

/**
 * Client wrapper for routed tab rows.
 *
 * The design system tab row takes a link component so it stays framework
 * agnostic, and a function cannot cross from a server component into a client
 * one. This boundary supplies next/link on the client and takes only
 * serialisable props from the page.
 */
export const HubTabs = ({
  items,
  activeId,
  label = 'Sections',
}: {
  readonly items: readonly TabItem[];
  readonly activeId: string;
  readonly label?: string;
}) => (
  <Tabs
    label={label}
    items={items}
    activeId={activeId}
    linkComponent={({ href, className, children, ...aria }) => (
      <Link href={href} className={className} {...aria}>
        {children}
      </Link>
    )}
  />
);
