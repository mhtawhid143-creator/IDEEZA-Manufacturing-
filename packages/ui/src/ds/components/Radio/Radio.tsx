import * as React from "react";
import { cn } from '../../../lib/ds-cn.js';

/**
 * Radio — mirrors Figma `A08 Selection Control` (Type=Radio) and its
 * `_Radio base` (Atoms — Input).
 *
 * Extracted from Figma, not approximated:
 *   circle   sm 20×20 · md 24×24 · always round · 2px border
 *   dot      sm 8×8 · md 10×10
 *   row gap  16px between control and text
 *   label    sm Body/SM · md Body/MD · color input/label
 *   support  sm Caption/SM · md Caption/MD · color input/helper
 *   text gap 4px
 *
 * Unlike the checkbox, a selected radio keeps the white fill and shows a
 * brand ring with a brand dot — it never fills solid.
 */
export type RadioSize = "sm" | "md";

const boxClass: Record<RadioSize, string> = {
  sm: "size-[20px]",
  md: "size-[24px]",
};
const dotClass: Record<RadioSize, string> = {
  sm: "size-[8px]",
  md: "size-[10px]",
};
const labelClass: Record<RadioSize, string> = {
  sm: "text-body-sm",
  md: "text-body-md",
};
const supportClass: Record<RadioSize, string> = {
  sm: "text-caption-sm",
  md: "text-caption-md",
};

export interface RadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  size?: RadioSize | undefined;
  label?: React.ReactNode | undefined;
  /** Second line under the label. Mirrors `Supporting text`. */
  description?: React.ReactNode | undefined;
  containerClassName?: string | undefined;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ size = "sm", label, description, className, containerClassName, disabled, id, ...props }, ref) => {
    const autoId = React.useId();
    const radioId = id ?? autoId;

    return (
      <div className={cn("flex items-start gap-[16px]", containerClassName)}>
        <span className="relative inline-flex shrink-0">
          <input
            ref={ref}
            id={radioId}
            type="radio"
            disabled={disabled}
            className={cn(
              "peer appearance-none rounded-full border-solid border-[2px] bg-input-bg border-input-border",
              "transition-[colors,box-shadow] duration-fast ease-standard outline-none",
              "hover:border-input-border-hover",
              "checked:border-bg-brand checked:hover:border-bg-brand-hover",
              "focus-visible:shadow-[0_0_0_3px_var(--color-focus-halo)]",
              "disabled:pointer-events-none disabled:border-input-border-disabled",
              boxClass[size],
              className
            )}
            {...props}
          />
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 m-auto rounded-full bg-bg-brand",
              "opacity-0 peer-checked:opacity-100",
              "peer-disabled:bg-text-disabled",
              dotClass[size]
            )}
          />
        </span>

        {(label || description) && (
          <span className="flex flex-col gap-[4px]">
            {label && (
              <label
                htmlFor={radioId}
                className={cn(
                  "cursor-pointer font-sans",
                  labelClass[size],
                  disabled ? "cursor-not-allowed text-text-disabled" : "text-input-label"
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <span
                className={cn(
                  "font-sans",
                  supportClass[size],
                  disabled ? "text-text-disabled" : "text-input-helper"
                )}
              >
                {description}
              </span>
            )}
          </span>
        )}
      </div>
    );
  }
);
Radio.displayName = "Radio";
