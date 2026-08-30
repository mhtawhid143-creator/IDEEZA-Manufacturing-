'use client';

import { useCallback, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { IconButton } from './icon-button.js';
import { Heading, Text } from './typography.js';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Shared behaviour for the modal and the drawer: focus moves in on open, is
 * trapped while open, Escape closes, the page behind does not scroll, and focus
 * returns to whatever opened it.
 */
const useOverlayBehaviour = (open: boolean, onClose: () => void) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    restoreTo.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panelRef.current)?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      (restoreTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (nodes === undefined || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (first === undefined || last === undefined) return;
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    },
    [onClose],
  );

  return { panelRef, onKeyDown };
};

const CloseIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: ReactNode;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}

const MODAL_SIZE = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' } as const;

export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const { panelRef, onKeyDown } = useOverlayBehaviour(open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={onKeyDown}>
      <div
        className="absolute inset-0 animate-fade-in bg-bg-overlay/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex max-h-[calc(100dvh-2rem)] w-full flex-col animate-slide-up rounded-xl bg-bg-surface p-6 shadow-5 focus-visible:outline-none',
          MODAL_SIZE[size],
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <Heading level={3} id={titleId}>
              {title}
            </Heading>
            {description !== undefined && (
              <Text tone="muted" id={descriptionId} className="mt-1">
                {description}
              </Text>
            )}
          </div>
          <IconButton label="Close" icon={CloseIcon} onClick={onClose} size="sm" />
        </div>
        {/*
          A tall modal scrolls its own body rather than growing past the screen:
          the footer is where the decision is, and a decision you cannot reach is
          not a decision. The header and the footer stay put.
        */}
        {children !== undefined && (
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">{children}</div>
        )}
        {footer !== undefined && (
          <div className="mt-6 flex shrink-0 flex-wrap items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export interface DrawerProps extends Omit<ModalProps, 'size'> {
  readonly side?: 'right' | 'left';
  readonly width?: 'sm' | 'md' | 'lg';
}

const DRAWER_WIDTH = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

/** The side panel the Figma quote details use. */
export const Drawer = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = 'right',
  width = 'md',
  className,
}: DrawerProps) => {
  const titleId = useId();
  const { panelRef, onKeyDown } = useOverlayBehaviour(open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 animate-fade-in bg-bg-overlay/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 flex w-full flex-col bg-bg-surface shadow-6 focus-visible:outline-none',
          'animate-slide-in-right',
          side === 'right' ? 'right-0' : 'left-0',
          DRAWER_WIDTH[width],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle p-5">
          <div className="min-w-0">
            <Heading level={3} id={titleId}>
              {title}
            </Heading>
            {description !== undefined && (
              <Text tone="muted" className="mt-1">
                {description}
              </Text>
            )}
          </div>
          <IconButton label="Close" icon={CloseIcon} onClick={onClose} size="sm" />
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer !== undefined && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle p-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
