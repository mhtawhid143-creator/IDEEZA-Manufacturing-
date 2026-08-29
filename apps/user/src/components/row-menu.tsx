'use client';

import Link from 'next/link';
import { DropdownMenu, type DropdownMenuProps } from '@ideeza/ui';

/**
 * The row action menu, wired to this app's router.
 *
 * Same reason as the breadcrumb trail and the hub tabs: the link component is a
 * function, so it is handed to the design system from a client component here
 * rather than at every table that draws a menu. Without it an item with an href
 * still navigates, but reloads the page.
 */
export const RowMenu = (props: Omit<DropdownMenuProps, 'linkComponent'>) => (
  <DropdownMenu
    {...props}
    linkComponent={({ href, className, role, onClick, onMouseEnter, children }) => (
      <Link
        href={href}
        className={className}
        role={role}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
      >
        {children}
      </Link>
    )}
  />
);
