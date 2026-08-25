'use client';

import Link from 'next/link';
import { Tabs, type TabItem } from '@ideeza/ui';

/**
 * Client wrapper for the routed hub tabs.
 *
 * The design system tab row takes a link component so it stays framework
 * agnostic, and a function cannot cross from a server component into a client
 * one. This boundary supplies next/link on the client and takes only
 * serialisable props from the page.
 */
export const HubTabs = ({
  items,
  activeId,
}: {
  readonly items: readonly TabItem[];
  readonly activeId: string;
}) => (
  <Tabs
    label="Manufacturing sections"
    items={items}
    activeId={activeId}
    linkComponent={({ href, className, children, ...aria }) => (
      <Link href={href} className={className} {...aria}>
        {children}
      </Link>
    )}
  />
);
