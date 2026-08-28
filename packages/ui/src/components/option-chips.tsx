'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface ChipOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
  /** A colour swatch, as the board and silkscreen choices have. */
  readonly swatch?: string;
  readonly hint?: string;
}

export interface OptionChipsProps {
  readonly label: string;
  readonly name: string;
  readonly options: readonly ChipOption[];
  readonly value: string;
  readonly onChange?: (value: string) => void;
  /** Shown as the first chip: the platform never forces a specification. */
  readonly openLabel?: string;
  readonly help?: ReactNode;
  readonly readOnly?: boolean;
  readonly className?: string;
}

/**
 * A row of choices, laid out as the specification screens in Figma have them:
 * the label on the left, the options as chips filling the space on the right.
 *
 * It is a radio group, not a set of buttons — one answer, arrow keys move
 * between them, and the group carries its own label. The first chip is the open
 * answer ("manufacturer's discretion"), because on this platform a buyer is
 * allowed not to have an opinion, and a missing answer has to be visible rather
 * than implied by an unselected row.
 */
export const OptionChips = ({
  label,
  name,
  options,
  value,
  onChange,
  openLabel = "Manufacturer's discretion",
  help,
  readOnly = false,
  className,
}: OptionChipsProps) => {
  const groupId = useId();
  const chips: readonly ChipOption[] = [{ value: '', label: openLabel }, ...options];

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-2 border-b border-line py-3 last:border-b-0 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:items-start sm:gap-4',
        className,
      )}
    >
      <div className="pt-1.5">
        <p id={groupId} className="text-sm text-body">
          {label}
        </p>
        {help !== undefined && (
          <p className="mt-0.5 text-xs text-muted">{help}</p>
        )}
      </div>

      <div role="radiogroup" aria-labelledby={groupId} className="flex flex-wrap gap-2">
        {chips.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value === '' ? 'open' : option.value}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                selected
                  ? 'border-brand bg-brand-surface text-brand'
                  : 'border-line bg-surface text-body hover:bg-raised',
                (option.disabled === true || readOnly) && 'cursor-not-allowed opacity-60',
              )}
              title={option.hint}
            >
              {option.swatch !== undefined && (
                <span
                  aria-hidden
                  className="h-4 w-4 rounded-full border border-line"
                  style={{ backgroundColor: option.swatch }}
                />
              )}
              {option.label}
              {/* The dot the design puts on a chosen chip is the radio itself:
                  a real control, so it can be clicked and reached by keyboard. */}
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                disabled={option.disabled === true || readOnly}
                onChange={() => onChange?.(option.value)}
                className={cn(
                  'h-4 w-4 shrink-0 appearance-none rounded-full border transition-colors',
                  selected
                    ? 'border-brand bg-brand ring-2 ring-inset ring-surface'
                    : 'border-line-input bg-surface',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
                  'disabled:cursor-not-allowed',
                )}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
};

export interface SpecSectionProps {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

/** The grey-headed section the specification screens are built from. */
export const SpecSection = ({
  title,
  description,
  actions,
  children,
  className,
}: SpecSectionProps) => (
  <section
    className={cn('overflow-hidden rounded-xl border border-line bg-surface', className)}
  >
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-raised px-4 py-3 md:px-6">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-heading">{title}</h2>
        {description !== undefined && (
          <p className="ids-measure mt-0.5 text-xs text-muted">{description}</p>
        )}
      </div>
      {actions}
    </header>
    <div className="px-4 py-2 md:px-6">{children}</div>
  </section>
);
