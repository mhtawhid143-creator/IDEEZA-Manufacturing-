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
            'text-sm font-medium text-text-primary',
            labelHidden && 'ids-sr-only',
          )}
        >
          {label}
          {required && (
            <span className="ml-0.5 text-text-error" aria-hidden>
              *
            </span>
          )}
        </label>
        {children}
        {hint !== undefined && error === undefined && (
          <p id={hintId} className="ids-measure text-xs text-text-tertiary">
            {hint}
          </p>
        )}
        {error !== undefined && (
          <p id={errorId} className="text-xs font-medium text-text-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
};

export const fieldControlClasses = (invalid: boolean): string =>
  cn(
    'w-full rounded-md border bg-bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary',
    'transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
    'disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-disabled',
    invalid ? 'border-border-error focus-visible:ring-focus-danger' : 'border-border hover:border-border-strong',
  );
