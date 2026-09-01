'use client';

import { useId } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface ChoiceChipsProps {
  readonly label: string;
  readonly options: readonly string[];
  /** Everything chosen so far. One entry when `single` is set. */
  readonly value: readonly string[];
  readonly onChange: (next: readonly string[]) => void;
  /** One answer rather than several — the chips behave as radios. */
  readonly single?: boolean;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly hint?: ReactNode;
  readonly error?: string | undefined;
  readonly className?: string;
}

/**
 * A wrapped row of chips a shop picks several of — the capability form's
 * answer to "which materials do you run?".
 *
 * `OptionChips` beside this one is a different question: one answer, laid out
 * with the label to the left, and a radio dot drawn inside the chip because a
 * buyer's specification has to show the answer it did not give. Here a shop
 * usually gives several answers, the label sits above as it does on every other
 * field in the form, and the chip's own colour is the whole state.
 *
 * They are buttons with `aria-pressed`, inside a group carrying the label, so a
 * screen reader hears the question, then each answer and whether it is on. The
 * single-answer variant swaps rather than adds — the design's "Batch
 * production: Yes / Limited / No" is one answer, and a chip row that let a shop
 * say both Yes and No would publish a contradiction.
 */
export const ChoiceChips = ({
  label,
  options,
  value,
  onChange,
  single = false,
  required = false,
  disabled = false,
  hint,
  error,
  className,
}: ChoiceChipsProps) => {
  const labelId = useId();
  const hintId = `${labelId}-hint`;

  const toggle = (option: string): void => {
    if (single) {
      onChange(value.includes(option) ? [] : [option]);
      return;
    }
    onChange(
      value.includes(option)
        ? value.filter((entry) => entry !== option)
        : [...value, option],
    );
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <p id={labelId} className="text-xs font-semibold text-input-label">
        {label}
        {required && (
          <span className="ml-1 text-text-error" aria-hidden>
            *
          </span>
        )}
      </p>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={hint === undefined && error === undefined ? undefined : hintId}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => toggle(option)}
              className={cn(
                'inline-flex items-center rounded-lg border px-3 py-1.5 text-sm transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus',
                selected
                  ? 'border-border-brand text-text-brand'
                  : 'border-border text-text-primary hover:border-border-strong hover:bg-bg-subtle',
                disabled && 'cursor-not-allowed opacity-disabled',
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      {error !== undefined ? (
        <p id={hintId} role="alert" className="text-xs text-input-error-text">
          {error}
        </p>
      ) : (
        hint !== undefined && (
          <p id={hintId} className="max-w-measure text-xs text-input-helper">
            {hint}
          </p>
        )
      )}
    </div>
  );
};
