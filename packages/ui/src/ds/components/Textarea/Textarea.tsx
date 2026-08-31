import * as React from "react";
import { cn } from '../../../lib/ds-cn.js';
import { FieldShell, controlChrome, type FieldSize } from "../Field/Field.js";

/**
 * Textarea — mirrors Figma `Textarea` (A05, Atoms — Input), 18 variants.
 *
 * Figma uses a `Rows` property rather than a pixel size:
 *   SM · 80px  · radius/lg  8  · pad 10/12/8/12 · value 14/20 · label 11/16
 *   MD · 104px · radius/xl 12 · pad 12/14/8/14 · value 14/20 · label 12/16
 *   LG · 128px · radius/2xl 16 · pad 14/16/8/16 · value 16/24 · label 14/20
 *
 * Padding is asymmetric — bottom stays 8 at every size, leaving room for the
 * resize handle. Helper text and the character counter share one footer row —
 * helper left, count right — exactly as in the Figma `Footer` frame.
 */
export type TextareaRows = "sm" | "md" | "lg";

/**
 * Figma padding is asymmetric — bottom is 8 at every size, leaving room for the
 * resize handle. Values here are the Figma numbers minus the 1.5px border, so
 * the rendered inset matches (see the note in Field).
 */
const rowsClass: Record<TextareaRows, string> = {
  sm: "min-h-[80px] rounded-[8px] pt-[8.5px] pr-[10.5px] pb-[6.5px] pl-[10.5px]",
  md: "min-h-[104px] rounded-[12px] pt-[10.5px] pr-[12.5px] pb-[6.5px] pl-[12.5px]",
  lg: "min-h-[128px] rounded-[16px] pt-[12.5px] pr-[14.5px] pb-[6.5px] pl-[14.5px]",
};

/** Value type ramp — LG steps up, matching Figma. */
const rowsValueClass: Record<TextareaRows, string> = {
  sm: "text-body-sm",
  md: "text-body-sm",
  lg: "text-body-md",
};

const rowsToFieldSize: Record<TextareaRows, FieldSize> = { sm: 36, md: 40, lg: 48 };

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> {
  /** Matches Figma's `Rows` property, not the HTML `rows` attribute. */
  rows?: TextareaRows | undefined;
  label?: React.ReactNode | undefined;
  required?: boolean | undefined;
  helperText?: React.ReactNode | undefined;
  error?: React.ReactNode | undefined;
  /** Shows a `0/200` counter under the field. Mirrors `hasCharCount`. */
  maxLength?: number | undefined;
  showCount?: boolean | undefined;
  containerClassName?: string | undefined;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      rows = "md",
      label,
      required,
      helperText,
      error,
      className,
      containerClassName,
      disabled,
      id,
      maxLength,
      showCount,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId();
    const areaId = id ?? autoId;
    const invalid = Boolean(error);
    const size = rowsToFieldSize[rows];

    const [count, setCount] = React.useState(String(value ?? defaultValue ?? "").length);
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCount(e.target.value.length);
      onChange?.(e);
    };

    return (
      <FieldShell
        size={size}
        label={label}
        required={required}
        helperText={helperText}
        error={error}
        disabled={disabled}
        htmlFor={areaId}
        className={containerClassName}
        footerRight={showCount && maxLength ? `${count}/${maxLength}` : undefined}
      >
        <div
          data-invalid={invalid}
          data-disabled={Boolean(disabled)}
          className={cn(controlChrome, rowsClass[rows], "items-stretch")}
        >
          <textarea
            ref={ref}
            id={areaId}
            disabled={disabled}
            maxLength={maxLength}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            aria-invalid={invalid || undefined}
            aria-describedby={helperText || error ? `${areaId}-description` : undefined}
            className={cn(
              // Figma draws a resize handle bottom-right, so the field is vertically resizable.
              "min-h-full w-full resize-y bg-transparent font-sans",
              rowsValueClass[rows],
              "text-input-text outline-none placeholder:text-input-placeholder",
              "disabled:cursor-not-allowed disabled:text-text-disabled disabled:placeholder:text-text-disabled",
              className
            )}
            {...props}
          />
        </div>

      </FieldShell>
    );
  }
);
Textarea.displayName = "Textarea";
