import * as React from "react";
import { cn } from "../../lib/cn.js";
import { ChevronDown } from "../../lib/icons.js";
import {
  FieldShell,
  controlChrome,
  controlClass,
  iconClass,
  valueClass,
  type FieldSize,
} from "../Field/Field.js";

/**
 * Select — mirrors Figma `A06 Select` (Atoms — Input), 35 variants.
 *
 * A native `<select>` under the shared field chrome, so keyboard, mobile
 * pickers and form submission behave correctly. Figma's `Open` state is the
 * browser's own popup; the trigger keeps the focus treatment.
 *
 * Shares the field ramp with every other control — height, radius, padding,
 * gap, value type and icon size all come from Field. A06 used to have its own
 * flat 12px padding and a different type step; Figma was corrected so that a
 * Select and an Input of the same height are identical apart from the chevron.
 */
export type SelectSize = FieldSize;

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: SelectSize;
  label?: React.ReactNode;
  required?: boolean;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  /** Shown as a disabled first option when the value is empty. */
  placeholder?: string;
  leftIcon?: React.ReactNode;
  containerClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      size = 40,
      label,
      required,
      helperText,
      error,
      placeholder,
      leftIcon,
      className,
      containerClassName,
      disabled,
      id,
      children,
      defaultValue,
      value,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId();
    const selectId = id ?? autoId;
    const invalid = Boolean(error);

    return (
      <FieldShell
        size={size}
        label={label}
        required={required}
        helperText={helperText}
        error={error}
        disabled={disabled}
        htmlFor={selectId}
        className={containerClassName}
      >
        <div
          data-invalid={invalid}
          data-disabled={Boolean(disabled)}
          className={cn(
            controlChrome,
            controlClass[size],
            iconClass[size],
            "relative [&_svg]:shrink-0 [&_svg]:text-icon-default"
          )}
        >
          {leftIcon}
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            value={value}
            defaultValue={defaultValue ?? (placeholder ? "" : undefined)}
            aria-invalid={invalid || undefined}
            aria-describedby={helperText || error ? `${selectId}-description` : undefined}
            className={cn(
              "min-w-0 flex-1 appearance-none bg-transparent font-sans outline-none",
              "text-input-text",
              // The placeholder option keeps the muted colour until something is chosen
              "invalid:text-input-placeholder [&:has(option[value='']:checked)]:text-input-placeholder",
              "disabled:cursor-not-allowed disabled:text-text-disabled",
              valueClass[size],
              className
            )}
            {...props}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {children}
          </select>
          <ChevronDown />
        </div>
      </FieldShell>
    );
  }
);
Select.displayName = "Select";
