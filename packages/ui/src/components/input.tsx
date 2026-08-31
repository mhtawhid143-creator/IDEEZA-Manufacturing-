'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn as merge } from '@ideeza/ds/cn';
import { Icon } from './icon.js';
import { fieldControlClasses, useFieldContext } from './form-field.js';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly leadingIcon?: ReactNode;
  readonly trailingSlot?: ReactNode;
  readonly invalid?: boolean;
}

/**
 * The single-line field, wearing the design system's control chrome (A04 Text
 * Input at the 40px size, from `@ideeza/ds`). The chrome reads error and
 * disabled from data attributes, so both are set beside the aria state.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leadingIcon, trailingSlot, invalid, className, id, ...rest },
  ref,
) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;

  const control = (
    <input
      ref={ref}
      id={id ?? field?.inputId}
      aria-invalid={isInvalid || undefined}
      data-invalid={isInvalid || undefined}
      data-disabled={rest.disabled === true || undefined}
      aria-describedby={field?.describedBy}
      required={rest.required ?? field?.required}
      className={merge(
        fieldControlClasses(isInvalid),
        leadingIcon !== undefined && 'pl-9',
        trailingSlot !== undefined && 'pr-9',
        className,
      )}
      {...rest}
    />
  );

  if (leadingIcon === undefined && trailingSlot === undefined) return control;

  return (
    <div className="relative">
      {leadingIcon !== undefined && (
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-icon-secondary"
          aria-hidden
        >
          {leadingIcon}
        </span>
      )}
      {control}
      {trailingSlot !== undefined && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailingSlot}</span>
      )}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, id, rows = 4, ...rest },
  ref,
) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  return (
    <textarea
      ref={ref}
      id={id ?? field?.inputId}
      rows={rows}
      aria-invalid={isInvalid || undefined}
      data-invalid={isInvalid || undefined}
      data-disabled={rest.disabled === true || undefined}
      aria-describedby={field?.describedBy}
      required={rest.required ?? field?.required}
      className={merge(fieldControlClasses(isInvalid, 'textarea'), 'resize-y', className)}
      {...rest}
    />
  );
});

export interface SearchInputProps extends Omit<InputProps, 'type'> {
  readonly label?: string;
}

/** The search box used above every Figma list. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { label = 'Search', placeholder = 'Search…', className, ...rest },
  ref,
) {
  return (
    <Input
      ref={ref}
      type="search"
      aria-label={label}
      placeholder={placeholder}
      className={className}
      leadingIcon={
        <Icon name="search" size={16} />
      }
      {...rest}
    />
  );
});
