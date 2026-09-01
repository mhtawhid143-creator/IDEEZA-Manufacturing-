'use client';

import { forwardRef, useId, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Checkbox as DsCheckbox, Radio as DsRadio, Toggle as DsToggle } from '@ideeza/ds';
import { cn } from '../lib/cn.js';

// `size` is the native input's character-width attribute, which nothing here
// ever used; omitting it keeps it from colliding with the system's size prop.
interface ChoiceBaseProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  readonly label: ReactNode;
  readonly description?: ReactNode;
}

/**
 * The selection controls are the design system's own — A08 Selection Control
 * and A10 Toggle from `@ideeza/ds` — wearing this repository's prop names.
 * The system's components carry the label and supporting text themselves, in
 * the same arrangement these wrappers used to draw by hand, so the only work
 * left here is the name mapping: our outer `className` is its
 * `containerClassName`.
 */
export const Checkbox = forwardRef<HTMLInputElement, ChoiceBaseProps>(function Checkbox(
  { label, description, className, ...rest },
  ref,
) {
  return (
    <DsCheckbox
      ref={ref}
      size="sm"
      label={label}
      description={description}
      {...(className === undefined ? {} : { containerClassName: className })}
      {...rest}
    />
  );
});

export const Radio = forwardRef<HTMLInputElement, ChoiceBaseProps>(function Radio(
  { label, description, className, ...rest },
  ref,
) {
  return (
    <DsRadio
      ref={ref}
      size="sm"
      label={label}
      description={description}
      {...(className === undefined ? {} : { containerClassName: className })}
      {...rest}
    />
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
 * The system's A10 Toggle (Radix Switch under the hood — keyboard and ARIA
 * come with it), keeping this repository's Switch API. The old Switch was a
 * native checkbox, so the input-shaped props are translated: `onChange`
 * becomes the switch's checked-change event carrying a synthetic target, and
 * the label stays this repository's own element, associated by id.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { label, labelHidden = false, className, id, checked, defaultChecked, disabled, name, value, required, onChange },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <DsToggle
        ref={ref}
        id={inputId}
        size="sm"
        {...(checked === undefined ? {} : { checked: Boolean(checked) })}
        {...(defaultChecked === undefined ? {} : { defaultChecked: Boolean(defaultChecked) })}
        {...(disabled === undefined ? {} : { disabled })}
        {...(name === undefined ? {} : { name })}
        {...(value === undefined ? {} : { value: String(value) })}
        {...(required === undefined ? {} : { required })}
        {...(onChange === undefined
          ? {}
          : {
              onCheckedChange: (next: boolean) => {
                onChange({
                  target: { checked: next },
                } as unknown as ChangeEvent<HTMLInputElement>);
              },
            })}
      />
      <label htmlFor={inputId} className={cn('text-sm text-input-label', labelHidden && 'sr-only')}>
        {label}
      </label>
    </div>
  );
});
