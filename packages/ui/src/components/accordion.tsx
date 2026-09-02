'use client';

import { useId, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { Icon } from './icon.js';

export interface AccordionItem {
  readonly id: string;
  readonly title: string;
  readonly description?: ReactNode;
  readonly content: ReactNode;
}

export interface AccordionProps {
  readonly label: string;
  readonly items: readonly AccordionItem[];
  /** Which rows start open. Everything else starts closed. */
  readonly initiallyOpen?: readonly string[];
  /**
   * Only one row open at a time. The settings panes leave this off, because a
   * person comparing two topics should not have to keep reopening the first.
   */
  readonly single?: boolean;
  readonly className?: string;
}

/**
 * A list of rows that open — the design's settings accordion.
 *
 * A button and a region, rather than `<details>`: the summary carries a title
 * and a description on two lines with a chevron opposite, which `<details>`
 * cannot lay out without fighting its own marker. `aria-expanded` and
 * `aria-controls` are on the button and the region is labelled by it, so a
 * screen reader is told the same thing the chevron says.
 */
export const Accordion = ({
  label,
  items,
  initiallyOpen = [],
  single = false,
  className,
}: AccordionProps) => {
  const base = useId();
  const [open, setOpen] = useState<readonly string[]>(initiallyOpen);

  const toggle = (id: string): void => {
    setOpen((current) => {
      if (current.includes(id)) return current.filter((entry) => entry !== id);
      return single ? [id] : [...current, id];
    });
  };

  return (
    <div aria-label={label} role="group" className={cn('flex flex-col', className)}>
      {items.map((item) => {
        const expanded = open.includes(item.id);
        const buttonId = `${base}-${item.id}-button`;
        const panelId = `${base}-${item.id}-panel`;
        return (
          <div key={item.id} className="border-b border-border-subtle last:border-b-0">
            <button
              type="button"
              id={buttonId}
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => toggle(item.id)}
              className="flex w-full items-start justify-between gap-3 px-1 py-4 text-left transition-colors hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text-primary">{item.title}</span>
                {item.description !== undefined && (
                  <span className="mt-0.5 block text-xs text-text-tertiary">
                    {item.description}
                  </span>
                )}
              </span>
              <Icon
                name={expanded ? 'chevron-down' : 'chevron-right'}
                size={20}
                className="mt-0.5 shrink-0 text-icon-secondary"
              />
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!expanded}
              className="pb-4 pl-4 pr-1"
            >
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
};
