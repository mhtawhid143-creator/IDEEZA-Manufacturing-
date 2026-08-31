'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

interface FieldContextValue {
  readonly inputId: string;
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
  readonly required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Every input reads its id, description and error state from here. */
export const useFieldContext = (): FieldContextValue | null => useContext(FieldContext);

export interface FormFieldProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly hint?: ReactNode;
  readonly error?: string | undefined;
  readonly required?: boolean;
  /** Hides the label visually but keeps it for assistive technology. */
  readonly labelHidden?: boolean;
  readonly className?: string;
}

/**
 * Label, control, hint and error as one unit.
 *
 * The label is always rendered and always associated with the control; a hidden
 * label is hidden visually only. Errors are announced, and the control is marked
 * invalid, so a form is usable without seeing the colour change.
 */
export const FormField = ({
  label,
  children,
  hint,
  error,
  required = false,
  labelHidden = false,
  className,
}: FormFieldProps) => {
  const base = useId();
  const inputId = `${base}-input`;
  const hintId = hint === undefined ? undefined : `${base}-hint`;
  const errorId = error === undefined ? undefined : `${base}-error`;
  const describedBy = [hintId, errorId].filter((value) => value !== undefined).join(' ') || undefined;

  return (
    <FieldContext.Provider
      value={{ inputId, describedBy, invalid: error !== undefined, required }}
    >
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label
          htmlFor={inputId}
          className={cn(
            'text-xs font-semibold text-input-label',
            labelHidden && 'sr-only',
          )}
        >
          {label}
          {required && (
            <span className="ml-1 text-text-error" aria-hidden>
              *
            </span>
          )}
        </label>
        {children}
        {hint !== undefined && error === undefined && (
          <p id={hintId} className="max-w-measure text-xs text-input-helper">
            {hint}
          </p>
        )}
        {error !== undefined && (
          <p id={errorId} className="text-xs text-input-error-text" role="alert">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
};

/**
 * The field surface every control shares, taken from the A04 Text Input spec:
 * a 12px radius, a 1.5px border, 14px text on the input surface, and the 3px
 * focus halo the whole system uses. The textarea padding differs because the
 * A05 Textarea frame pads 14px horizontally and less at the foot than the
 * single-line field does; `cn` does not resolve Tailwind conflicts, so the
 * padding is chosen here rather than overridden by a caller.
 */
export const fieldControlClasses = (
  invalid: boolean,
  padding: 'input' | 'textarea' = 'input',
): string =>
  cn(
    'w-full rounded-xl border-1.5 bg-input-bg text-sm text-input-text placeholder:text-input-placeholder',
    padding === 'textarea' ? 'px-3.5 pb-2 pt-3' : 'px-3',
    'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus',
    'disabled:cursor-not-allowed disabled:bg-input-bg-disabled disabled:border-input-border-disabled disabled:text-text-disabled',
    invalid ? 'border-input-border-error focus-visible:ring-focus-danger' : 'border-input-border hover:border-input-border-hover focus-visible:border-input-border-focus',
  );
