'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { controlChrome, controlClass, valueClass } from '@ideeza/ds/field';
import { cn as merge } from '@ideeza/ds/cn';
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
 * Label, control, hint and error as one unit — this repository's M27 Form
 * Field. The design system builds the label into each control instead; here
 * the label must stay outside so one wrapper serves every control, so the
 * words are drawn here and the control chrome comes from the system below.
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
 * The field surface every control shares — literally the design system's:
 * `controlChrome` (fill, 1.5px border, hover, the 3px focus halo, error and
 * disabled treatments) with the 40px size's geometry and value type from the
 * vendored Field primitives (`@ideeza/ds`). The chrome reads its error and
 * disabled states from `data-invalid` / `data-disabled`, which the controls
 * set alongside `aria-invalid`; native `disabled:` fallbacks stay so a control
 * rendered without the attribute still greys out. The textarea trades the
 * fixed 40px geometry for its own padding, since the A05 frame pads 14px
 * horizontally and less at the foot; the merge-aware class joiner is the
 * system's, so a caller's `pl-9` can win over the chrome's padding.
 */
export const fieldControlClasses = (
  invalid: boolean,
  padding: 'input' | 'textarea' = 'input',
): string =>
  merge(
    controlChrome,
    padding === 'textarea' ? 'rounded-xl px-3.5 pb-2 pt-3' : controlClass[40],
    valueClass[40],
    'w-full placeholder:text-input-placeholder',
    'disabled:pointer-events-none disabled:bg-input-bg-disabled disabled:border-input-border-disabled disabled:text-text-disabled',
    // The attribute drives the chrome; the flag exists so a caller that knows
    // its state at class-composition time gets the same border immediately.
    invalid && 'border-input-border-error hover:border-input-border-error',
  );
