'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './icon.js';
import { cn } from '../lib/cn.js';

interface ChoiceBaseProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  readonly label: ReactNode;
  readonly description?: ReactNode;
}

/**
 * The A08 Selection Control box at size sm: a 20px control with a 2px border
 * on the input surface, a 6px radius on the checkbox, and the system's 3px
 * focus halo. A checked checkbox is a flat brand fill with no visible border,
 * so its checked border is painted the same token as its fill; a checked radio
 * keeps the surface and paints only its ring (the spec binds the ring to the
 * brand fill token, not the border token). The stacked `checked:hover:`
 * classes exist because a bare `hover:` rule wins over `checked:` in the
 * stylesheet and would grey a checked control under the pointer.
 */
const controlClasses = (kind: 'checkbox' | 'radio'): string =>
  cn(
    'peer h-5 w-5 shrink-0 appearance-none border-2 bg-input-bg transition-colors duration-fast',
    kind === 'radio' ? 'rounded-full' : 'rounded-md',
    'border-input-border hover:border-input-border-hover',
    'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus',
    kind === 'checkbox'
      ? 'checked:border-bg-brand checked:bg-bg-brand checked:hover:border-bg-brand-hover checked:hover:bg-bg-brand-hover'
      : 'checked:border-bg-brand checked:hover:border-bg-brand-hover',
    'disabled:cursor-not-allowed disabled:border-input-border-disabled',
    kind === 'checkbox' &&
      'disabled:checked:border-input-border-disabled disabled:checked:bg-input-bg-disabled',
  );

export const Checkbox = forwardRef<HTMLInputElement, ChoiceBaseProps>(function Checkbox(
  { label, description, className, id, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={cn('flex items-start gap-4', className)}>
      <span className="relative inline-flex">
        <input ref={ref} id={inputId} type="checkbox" className={controlClasses('checkbox')} {...rest} />
        {/* The mark exists only while checked, drawn on-brand over the fill;
            when the control is disabled the spec swaps it to the disabled icon
            colour rather than fading the whole control. */}
        <Icon
          name="check"
          size={14}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-icon-on-brand opacity-0 peer-checked:opacity-100 peer-disabled:text-icon-disabled"
        />
      </span>
      <span className="min-w-0">
        <label htmlFor={inputId} className="block text-sm text-input-label">
          {label}
        </label>
        {description !== undefined && (
          <span className="mt-1 block text-2xs text-input-helper">{description}</span>
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
    <div className={cn('flex items-start gap-4', className)}>
      <span className="relative inline-flex">
        <input ref={ref} id={inputId} type="radio" className={controlClasses('radio')} {...rest} />
        {/* The 8px dot carries the selection; disabled-and-checked swaps it to
            the disabled field surface, exactly as the spec paints it. */}
        <span className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg-brand opacity-0 peer-checked:opacity-100 peer-disabled:bg-input-bg-disabled" />
      </span>
      <span className="min-w-0">
        <label htmlFor={inputId} className="block text-sm text-input-label">
          {label}
        </label>
        {description !== undefined && (
          <span className="mt-1 block text-2xs text-input-helper">{description}</span>
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
    {/* The legend names the group the way a field label names its control, so
        it wears the form-label treatment from the M27 Form Field spec. */}
    <legend className={cn('mb-1 text-xs font-semibold text-input-label', legendHidden && 'sr-only')}>
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
 * semantics and keyboard behaviour for free. The track and thumb follow the
 * A10 Toggle spec at size sm: a 36×20 track that wears the input border colour
 * while off and the brand fill while on, with a 16px surface-coloured thumb.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, labelHidden = false, className, id, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        role="switch"
        className={cn(
          'peer relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-input-border transition-colors duration-fast',
          'hover:bg-input-border-hover',
          // The stacked checked:hover: class keeps a hovered-on switch on the
          // brand ramp; a bare hover: rule would win over checked: otherwise.
          'checked:bg-bg-brand checked:hover:bg-bg-brand-hover',
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus',
          'disabled:cursor-not-allowed disabled:bg-input-bg-disabled disabled:checked:bg-input-bg-disabled',
          'before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-bg-surface before:transition-transform before:duration-fast',
          'checked:before:translate-x-4',
        )}
        {...rest}
      />
      <label htmlFor={inputId} className={cn('text-sm text-input-label', labelHidden && 'sr-only')}>
        {label}
      </label>
    </div>
  );
});
