import * as React from "react";
import { cn } from '../../../lib/ds-cn.js';
import { ChevronDown } from '../../../lib/ds-icons.js';
import {
  FieldShell,
  controlChrome,
  controlClass,
  iconClass,
  valueClass,
  type FieldSize,
} from "../Field/Field.js";

/**
 * Input — mirrors Figma `Text Input` (A04, Atoms — Input), 240 variants.
 *
 * Figma variant map:
 * - Size  → `size` — 32 / 36 / 40 / 44 / 48 (named by pixel height, as in Figma)
 * - Type  → `leftIcon` / `rightIcon` / `prefix` / `suffix` /
 *            `prefixSelect` / `suffixSelect` (both together = `Both Select`)
 * - State → pseudo-classes + `error` + `disabled`
 *
 * Geometry per size (height · radius · padding-x):
 *   32 · 8  · 10   36 · 8  · 10   40 · 12 · 12   44 · 12 · 12   48 · 16 · 14
 *
 * Prefix and suffix addons are inset by the 1.5px border and given the inner
 * corner radius, so the field border stays visible behind them — the same fix
 * applied to the Figma component.
 */
export type InputSize = FieldSize;

/** Inner radius for an addon sitting against the border: field radius − 1.5px. */
const addonRadius: Record<InputSize, string> = {
  32: "rounded-l-[6.5px]",
  36: "rounded-l-[6.5px]",
  40: "rounded-l-[10.5px]",
  44: "rounded-l-[10.5px]",
  48: "rounded-l-[14.5px]",
};
const addonRadiusRight: Record<InputSize, string> = {
  32: "rounded-r-[6.5px]",
  36: "rounded-r-[6.5px]",
  40: "rounded-r-[10.5px]",
  44: "rounded-r-[10.5px]",
  48: "rounded-r-[14.5px]",
};
/**
 * The addon replaces the field's edge padding, so it carries the full Figma
 * value minus the border it sits behind — matching the field's own inset.
 */
const addonPad: Record<InputSize, string> = {
  32: "px-[8.5px]",
  36: "px-[8.5px]",
  40: "px-[10.5px]",
  44: "px-[10.5px]",
  48: "px-[12.5px]",
};

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  size?: InputSize | undefined;
  label?: React.ReactNode | undefined;
  required?: boolean | undefined;
  helperText?: React.ReactNode | undefined;
  /** Error message — switches the field to the error treatment. */
  error?: React.ReactNode | undefined;
  /** Icon inside the field, before the value. */
  leftIcon?: React.ReactNode | undefined;
  /** Icon inside the field, after the value. */
  rightIcon?: React.ReactNode | undefined;
  /** Text addon flush to the left edge, e.g. `$` or `https://`. */
  prefix?: React.ReactNode | undefined;
  /** Text addon flush to the right edge, e.g. `.com` or `USD`. */
  suffix?: React.ReactNode | undefined;
  /**
   * `<option>` elements for a select addon on the left.
   * Mirrors Figma `Type=Prefix Select`; combine with `suffixSelect` for
   * `Type=Both Select`.
   */
  prefixSelect?: React.ReactNode | undefined;
  /** Props forwarded to the left addon's `<select>`. */
  prefixSelectProps?: React.SelectHTMLAttributes<HTMLSelectElement> | undefined;
  /** `<option>` elements for a select addon on the right. `Type=Suffix Select`. */
  suffixSelect?: React.ReactNode | undefined;
  /** Props forwarded to the right addon's `<select>`. */
  suffixSelectProps?: React.SelectHTMLAttributes<HTMLSelectElement> | undefined;
  /** Class for the field shell rather than the `<input>` itself. */
  containerClassName?: string | undefined;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 40,
      label,
      required,
      helperText,
      error,
      leftIcon,
      rightIcon,
      prefix,
      suffix,
      prefixSelect,
      prefixSelectProps,
      suffixSelect,
      suffixSelectProps,
      className,
      containerClassName,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const invalid = Boolean(error);

    const addonShell = (side: "l" | "r", extra?: string) =>
      cn(
        "flex shrink-0 self-stretch items-center bg-bg-subtle text-input-placeholder",
        "font-sans",
        valueClass[size],
        addonPad[size],
        side === "l" ? addonRadius[size] : addonRadiusRight[size],
        extra
      );

    const addon = (node: React.ReactNode, side: "l" | "r") => (
      <span className={addonShell(side)}>{node}</span>
    );

    /** Figma `Prefix Select` / `Suffix Select` — a select plus a chevron, inside the addon. */
    const selectAddon = (
      options: React.ReactNode,
      side: "l" | "r",
      selectProps?: React.SelectHTMLAttributes<HTMLSelectElement>
    ) => (
      <span className={addonShell(side, "gap-[4px] text-input-text")}>
        <select
          disabled={disabled}
          {...selectProps}
          className={cn(
            "cursor-pointer appearance-none bg-transparent font-sans outline-none",
            "text-input-text disabled:cursor-not-allowed disabled:text-text-disabled",
            valueClass[size],
            selectProps?.className
          )}
        >
          {options}
        </select>
        <ChevronDown className="shrink-0 text-icon-default" />
      </span>
    );

    return (
      <FieldShell
        size={size}
        label={label}
        required={required}
        helperText={helperText}
        error={error}
        disabled={disabled}
        htmlFor={inputId}
        className={containerClassName}
      >
        <div
          data-invalid={invalid}
          data-disabled={Boolean(disabled)}
          className={cn(
            controlChrome,
            controlClass[size],
            iconClass[size],
            // The addon supplies the edge padding, so drop it from the shell.
            (prefix || prefixSelect) && "pl-[1.5px]",
            (suffix || suffixSelect) && "pr-[1.5px]",
            "[&_svg]:shrink-0 [&_svg]:text-icon-default"
          )}
        >
          {prefixSelect ? selectAddon(prefixSelect, "l", prefixSelectProps) : null}
          {prefix ? addon(prefix, "l") : null}
          {leftIcon}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={helperText || error ? `${inputId}-description` : undefined}
            className={cn(
              "min-w-0 flex-1 bg-transparent font-sans text-input-text outline-none",
              "placeholder:text-input-placeholder",
              "disabled:cursor-not-allowed disabled:text-text-disabled disabled:placeholder:text-text-disabled",
              valueClass[size],
              className
            )}
            {...props}
          />
          {rightIcon}
          {suffix ? addon(suffix, "r") : null}
          {suffixSelect ? selectAddon(suffixSelect, "r", suffixSelectProps) : null}
        </div>
      </FieldShell>
    );
  }
);
Input.displayName = "Input";
