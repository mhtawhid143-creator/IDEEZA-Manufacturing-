'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { Icon } from './icon.js';
import { cn } from '../lib/cn.js';
import { fieldControlClasses, useFieldContext } from './form-field.js';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly invalid?: boolean;
}

/**
 * A native select on purpose: it is keyboard and screen reader correct
 * everywhere, and on a phone it opens the platform picker.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, invalid, className, id, ...rest },
  ref,
) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  return (
    <div className="relative">
      <select
        ref={ref}
        id={id ?? field?.inputId}
        aria-invalid={isInvalid || undefined}
        aria-describedby={field?.describedBy}
        required={rest.required ?? field?.required}
        className={cn(
          fieldControlClasses(isInvalid),
          'h-10 appearance-none pr-9',
          rest.value === '' && 'text-text-tertiary',
          className,
        )}
        {...rest}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevron-down"
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
      />
    </div>
  );
});
