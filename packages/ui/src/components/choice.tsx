'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

interface ChoiceBaseProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  readonly label: ReactNode;
  readonly description?: ReactNode;
}

const boxClasses = (round: boolean): string =>
  cn(
    'peer h-4 w-4 shrink-0 appearance-none border bg-bg-surface transition-colors',
    round ? 'rounded-full' : 'rounded-sm',
    'border-border hover:border-border-brand',
    'checked:border-border-brand checked:bg-bg-brand',
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
    'disabled:cursor-not-allowed disabled:border-border disabled:bg-bg-subtle',
  );

export const Checkbox = forwardRef<HTMLInputElement, ChoiceBaseProps>(function Checkbox(
  { label, description, className, id, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <span className="relative mt-0.5 inline-flex">
        <input ref={ref} id={inputId} type="checkbox" className={boxClasses(false)} {...rest} />
        <svg
          className="pointer-events-none absolute left-0 top-0 h-4 w-4 text-text-on-brand opacity-0 peer-checked:opacity-100"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path d="m4 8.5 2.5 2.5L12 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="min-w-0">
        <label htmlFor={inputId} className="block text-sm text-text-primary">
          {label}
        </label>
        {description !== undefined && (
          <span className="mt-0.5 block text-xs text-text-tertiary">{description}</span>
        )}
      </span>
    </div>
  );
});

export const Radio = forwardRef<HTMLInputElement, ChoiceBaseProps>(function Radio(
  { label, description, className, id, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <span className="relative mt-0.5 inline-flex">
        <input ref={ref} id={inputId} type="radio" className={boxClasses(true)} {...rest} />
        <span className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg-surface opacity-0 peer-checked:opacity-100" />
      </span>
      <span className="min-w-0">
        <label htmlFor={inputId} className="block text-sm text-text-primary">
          {label}
        </label>
        {description !== undefined && (
          <span className="mt-0.5 block text-xs text-text-tertiary">{description}</span>
        )}
      </span>
    </div>
  );
});

export interface RadioGroupProps {
  readonly legend: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly legendHidden?: boolean;
}

/** A radio group needs a fieldset and a legend to be announced as a group. */
export const RadioGroup = ({ legend, children, className, legendHidden = false }: RadioGroupProps) => (
  <fieldset className={cn('flex flex-col gap-2', className)}>
    <legend className={cn('mb-1 text-sm font-medium text-text-primary', legendHidden && 'ids-sr-only')}>
      {legend}
    </legend>
    {children}
  </fieldset>
);

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> {
  readonly label: string;
  readonly labelHidden?: boolean;
}

/**
 * A checkbox with a switch presentation. Using a real checkbox keeps the form
 * semantics and keyboard behaviour for free.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, labelHidden = false, className, id, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        role="switch"
        className={cn(
          'peer relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-gray-200 transition-colors',
          'checked:bg-bg-brand',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
          'disabled:cursor-not-allowed disabled:bg-bg-subtle',
          'before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform',
          'checked:before:translate-x-4',
        )}
        {...rest}
      />
      <label htmlFor={inputId} className={cn('text-sm text-text-primary', labelHidden && 'ids-sr-only')}>
        {label}
      </label>
    </div>
  );
});
