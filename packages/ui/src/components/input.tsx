'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Icon } from './icon.js';
import { cn } from '../lib/cn.js';
import { fieldControlClasses, useFieldContext } from './form-field.js';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly leadingIcon?: ReactNode;
  readonly trailingSlot?: ReactNode;
  readonly invalid?: boolean;
}

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
      aria-describedby={field?.describedBy}
      required={rest.required ?? field?.required}
      className={cn(
        fieldControlClasses(isInvalid),
        'h-10',
        leadingIcon !== undefined && 'pl-9',
        trailingSlot !== undefined && 'pr-10',
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
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          aria-hidden
        >
          {leadingIcon}
        </span>
      )}
      {control}
      {trailingSlot !== undefined && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailingSlot}</span>
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
      aria-describedby={field?.describedBy}
      required={rest.required ?? field?.required}
      className={cn(fieldControlClasses(isInvalid), 'resize-y py-2 leading-5', className)}
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
      className={cn('rounded-lg', className)}
      leadingIcon={
        <Icon name="search" size={16} />
      }
      {...rest}
    />
  );
});
