import * as React from "react";
import { cn } from "../../lib/cn.js";

/**
 * Field — the label / control / helper wrapper shared by every input in
 * Figma `⚛️ Atoms — Input`. Not exported as a standalone component; Input,
 * Textarea and Select compose it so the three stay identical.
 *
 * Figma per-size type ramp (Text Input A04):
 *   32 · label Label/SM · helper Caption/MD · row gap 4
 *   36 · label Label/SM · helper Caption/MD · row gap 4
 *   40 · label Label/MD · helper Caption/MD · row gap 4
 *   44 · label Label/MD · helper Caption/MD · row gap 6
 *   48 · label Label/LG · helper Caption/MD · row gap 6
 *
 * Everything is a Figma text style rather than a size, so weight and
 * tracking travel with the size instead of being set alongside it.
 */
export type FieldSize = 32 | 36 | 40 | 44 | 48;

export const fieldLabelClass: Record<FieldSize, string> = {
  32: "text-label-sm",
  36: "text-label-sm",
  40: "text-label-md",
  44: "text-label-md",
  48: "text-label-lg",
};

export const fieldRowGap: Record<FieldSize, string> = {
  32: "gap-[4px]",
  36: "gap-[4px]",
  40: "gap-[4px]",
  44: "gap-[6px]",
  48: "gap-[6px]",
};

/**
 * Control geometry — height, radius, padding, inner gap.
 *
 * Figma measures padding from the frame edge and its INSIDE stroke sits inside
 * that padding, so a field with padding 12 puts its text 12px from the outer
 * edge. CSS border-box adds the border on top of the padding, so the padding
 * here is the Figma value minus the 1.5px border: 10→8.5, 12→10.5, 14→12.5.
 * The rendered offset is then identical to the design file.
 */
export const controlClass: Record<FieldSize, string> = {
  32: "h-[32px] rounded-[8px] px-[8.5px] gap-[8px]",
  36: "h-[36px] rounded-[8px] px-[8.5px] gap-[8px]",
  40: "h-[40px] rounded-[12px] px-[10.5px] gap-[8px]",
  44: "h-[44px] rounded-[12px] px-[10.5px] gap-[8px]",
  48: "h-[48px] rounded-[16px] px-[12.5px] gap-[8px]",
};

/** Value / placeholder type ramp. */
export const valueClass: Record<FieldSize, string> = {
  32: "text-body-sm",
  36: "text-body-sm",
  40: "text-body-sm",
  44: "text-body-md",
  48: "text-body-md",
};

export const iconClass: Record<FieldSize, string> = {
  32: "[&_svg]:size-[16px]",
  36: "[&_svg]:size-[16px]",
  40: "[&_svg]:size-[16px]",
  44: "[&_svg]:size-[20px]",
  48: "[&_svg]:size-[20px]",
};

/**
 * Shared control chrome: fill, 1.5px border, hover, focus halo, error, disabled.
 * `data-invalid` drives the error treatment so it works on wrappers that are
 * not form controls (Select trigger, Textarea shell).
 */
export const controlChrome = [
  "flex w-full items-center bg-input-bg text-input-text",
  "border-solid border-[1.5px] border-input-border",
  "transition-[colors,box-shadow] duration-fast ease-standard",
  "hover:border-input-border-hover",
  "outline-none",
  "focus-within:border-input-border-focus",
  "focus-within:shadow-[0_0_0_3px_var(--color-focus-halo)]",
  // Error — border stays red, the halo turns red too
  "data-[invalid=true]:border-input-border-error",
  "data-[invalid=true]:hover:border-input-border-error",
  "data-[invalid=true]:focus-within:shadow-[0_0_0_3px_var(--color-focus-halo-danger)]",
  // Disabled
  "data-[disabled=true]:pointer-events-none",
  "data-[disabled=true]:bg-input-bg-disabled",
  "data-[disabled=true]:border-input-border-disabled",
  "data-[disabled=true]:text-text-disabled",
].join(" ");

export interface FieldShellProps {
  size?: FieldSize;
  label?: React.ReactNode;
  /** Adds the required marker to the label. */
  required?: boolean;
  helperText?: React.ReactNode;
  /** Error message — replaces `helperText` and switches the control to the error treatment. */
  error?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  /** id of the control, so the label and helper wire up correctly. */
  htmlFor?: string;
  /**
   * Rendered at the right of the message row, opposite the helper text.
   * Figma's Textarea puts its character counter here — helper left, count
   * right, on one line.
   */
  footerRight?: React.ReactNode;
  children: React.ReactNode;
}

export function FieldShell({
  size = 40,
  label,
  required,
  helperText,
  error,
  disabled,
  className,
  htmlFor,
  footerRight,
  children,
}: FieldShellProps) {
  const message = error ?? helperText;
  return (
    <div className={cn("flex w-full flex-col", fieldRowGap[size], className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className={cn(
            "font-sans",
            fieldLabelClass[size],
            disabled ? "text-text-disabled" : "text-input-label"
          )}
        >
          {label}
          {required && (
            <span className="ml-[2px] text-input-error-text" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {children}

      {(message || footerRight) && (
        <div className="flex items-start justify-between gap-[8px]">
          <p
            id={htmlFor ? `${htmlFor}-description` : undefined}
            className={cn(
              // Helper is Caption/MD; the error swaps to Label/MD, which is
              // the same 12/16 in semibold with the label's tracking.
              "font-sans",
              error ? "text-label-md" : "text-caption-md",
              disabled
                ? "text-text-disabled"
                : error
                  ? "text-input-error-text"
                  : "text-input-helper"
            )}
          >
            {message}
          </p>
          {footerRight && (
            <span
              className={cn(
                "shrink-0 font-sans text-caption-md tabular-nums",
                disabled ? "text-text-disabled" : "text-input-helper"
              )}
            >
              {footerRight}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
