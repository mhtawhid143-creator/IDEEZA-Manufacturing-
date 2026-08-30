'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn.js';

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly onSelect?: () => void;
  /**
   * Where the item goes. It is rendered as a link — through linkComponent when
   * one is given, and as a plain anchor otherwise — so it navigates, opens in a
   * new tab, and reads as a link to a screen reader.
   */
  readonly href?: string;
  readonly tone?: 'default' | 'danger';
  readonly disabled?: boolean;
}

export interface DropdownMenuProps {
  readonly trigger: (props: {
    readonly ref: (node: HTMLButtonElement | null) => void;
    readonly onClick: () => void;
    readonly 'aria-expanded': boolean;
    readonly 'aria-haspopup': 'menu';
    readonly id: string;
  }) => ReactNode;
  readonly items: readonly MenuItem[];
  readonly align?: 'start' | 'end';
  readonly className?: string;
  readonly label?: string;
  /**
   * A line above the items saying what the menu belongs to — the account it
   * would sign out of, say. It is not an item: nothing happens when it is
   * pressed, and offering it as a command that happens to be unavailable is a
   * worse answer than not offering it at all.
   */
  readonly heading?: string;
  /**
   * Renders an item that has an href. Without it the item is a plain anchor,
   * which navigates correctly but reloads the page.
   */
  readonly linkComponent?: (props: {
    readonly href: string;
    readonly className: string;
    readonly role: 'menuitem';
    readonly onClick: () => void;
    readonly onMouseEnter: () => void;
    readonly children: ReactNode;
  }) => ReactNode;
}

/**
 * The row action menu used across the Figma tables.
 *
 * Keyboard behaviour is the point of hand rolling this: arrows move, Home and
 * End jump, Escape closes and returns focus to the trigger, and a click outside
 * closes without swallowing the click.
 */
export const DropdownMenu = ({
  trigger,
  items,
  align = 'end',
  className,
  label = 'Actions',
  heading,
  linkComponent,
}: DropdownMenuProps) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerId = useId();

  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) === true) return;
      if (triggerRef.current?.contains(target) === true) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) menuRef.current?.focus();
  }, [open]);

  const enabled = items.filter((item) => item.disabled !== true);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        const next = current + direction;
        if (next < 0) return enabled.length - 1;
        if (next >= enabled.length) return 0;
        return next;
      });
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, enabled.length - 1));
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const item = enabled[activeIndex];
      if (item === undefined) return;
      const holder = menuRef.current?.querySelector<HTMLElement>(
        `[data-item="${CSS.escape(item.id)}"]`,
      );
      const node =
        holder === null || holder === undefined
          ? null
          : holder.matches('a, button')
            ? holder
            : holder.querySelector<HTMLElement>('a, button');
      if (node !== null) {
        node.click();
        return;
      }
      item.onSelect?.();
      close(true);
    }
  };

  return (
    <div className={cn('relative inline-flex', className)}>
      {trigger({
        ref: (node) => {
          triggerRef.current = node;
        },
        onClick: () => {
          setActiveIndex(0);
          setOpen((value) => !value);
        },
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        id: triggerId,
      })}
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          aria-labelledby={triggerId}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className={cn(
            'absolute top-full z-40 mt-1 min-w-48 animate-slide-up rounded-lg border border-border-subtle bg-bg-surface p-1 shadow-3 focus-visible:outline-none',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {heading !== undefined && (
            <p className="truncate border-b border-border-subtle px-3 py-2 text-xs text-text-tertiary">
              {heading}
            </p>
          )}
          {items.map((item, index) => {
            const enabledIndex = enabled.indexOf(item);
            const isActive = enabledIndex === activeIndex;
            const appearance = cn(
              'flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors',
              item.tone === 'danger' ? 'text-text-error' : 'text-text-primary',
              isActive && 'bg-bg-surface-raised',
              item.disabled === true && 'cursor-not-allowed opacity-50',
            );
            const hover = (): void => {
              if (enabledIndex >= 0) setActiveIndex(enabledIndex);
            };
            const chosen = (): void => {
              item.onSelect?.();
              close(false);
            };

            if (item.href !== undefined && item.disabled !== true) {
              const linked = linkComponent?.({
                href: item.href,
                className: appearance,
                role: 'menuitem',
                onClick: chosen,
                onMouseEnter: hover,
                children: item.label,
              });
              return (
                <span key={item.id} data-item={item.id} className="contents">
                  {linked ?? (
                    <a
                      role="menuitem"
                      href={item.href}
                      className={appearance}
                      onClick={chosen}
                      onMouseEnter={hover}
                    >
                      {item.label}
                    </a>
                  )}
                </span>
              );
            }

            return (
              <button
                key={item.id}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onMouseEnter={hover}
                onClick={() => {
                  item.onSelect?.();
                  close(true);
                }}
                className={appearance}
                data-item={item.id}
                data-index={index}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
