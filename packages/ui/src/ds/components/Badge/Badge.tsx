import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from '../../../lib/ds-cn.js';

/**
 * Badge — mirrors Figma `A17 Badge` (Atoms — Display).
 *
 * Figma variant map:
 * - Style → `variant` (Subtle / Solid / Outline)
 * - Color → `color`   (Brand / Neutral / Blue / Success / Warning / Error)
 * - Size  → `size`    (SM / MD / LG)
 * - Icon slots → `leftIcon` / `rightIcon` (Country flag, Avatar, Icon content swaps)
 * - X close → `onDismiss`
 * - Dot → `dot`
 */
export const badgeVariants = cva(
  // No `font-medium` — the Label styles carry semibold, matching Figma.
  "inline-flex items-center font-sans whitespace-nowrap rounded-full",
  {
    variants: {
      variant: { subtle: "", solid: "", outline: "border bg-transparent" },
      color: { brand: "", neutral: "", blue: "", success: "", warning: "", error: "" },
      size: {
        sm: "h-[20px] gap-[4px] px-[6px] text-label-sm [&_svg]:size-[12px]",
        md: "h-[24px] gap-[4px] px-[8px] text-label-md [&_svg]:size-[14px]",
        // Figma A17 LG is h24 with 11/16 semibold — smaller type than MD, which
        // looks like a defect in the file. Height and padding follow Figma; the
        // type is left one step up so LG still reads as the largest badge.
        lg: "h-[24px] gap-[6px] px-[10px] text-label-md [&_svg]:size-[16px]",
      },
    },
    compoundVariants: [
      { variant: "subtle", color: "brand", class: "bg-bg-brand-subtle text-text-brand" },
      { variant: "subtle", color: "neutral", class: "bg-bg-subtle text-text-secondary" },
      { variant: "subtle", color: "blue", class: "bg-bg-blue-subtle text-text-blue" },
      { variant: "subtle", color: "success", class: "bg-bg-success-subtle text-text-success" },
      { variant: "subtle", color: "warning", class: "bg-bg-warning-subtle text-text-warning" },
      { variant: "subtle", color: "error", class: "bg-bg-error-subtle text-text-error" },
      { variant: "solid", color: "brand", class: "bg-bg-brand text-text-on-brand" },
      { variant: "solid", color: "neutral", class: "bg-bg-inverse text-text-inverse" },
      { variant: "solid", color: "blue", class: "bg-bg-blue text-text-on-brand" },
      { variant: "solid", color: "success", class: "bg-bg-success text-text-on-brand" },
      { variant: "solid", color: "warning", class: "bg-bg-warning text-text-primary" },
      { variant: "solid", color: "error", class: "bg-bg-error text-text-on-brand" },
      { variant: "outline", color: "brand", class: "border-border-brand text-text-brand" },
      { variant: "outline", color: "neutral", class: "border-border text-text-secondary" },
      { variant: "outline", color: "blue", class: "border-[var(--color-blue-300)] text-text-blue" },
      { variant: "outline", color: "success", class: "border-[var(--color-green-500)] text-text-success" },
      { variant: "outline", color: "warning", class: "border-[var(--color-yellow-500)] text-text-warning" },
      { variant: "outline", color: "error", class: "border-border-error text-text-error" },
    ],
    defaultVariants: { variant: "subtle", color: "brand", size: "md" },
  }
);

const dotColor: Record<string, string> = {
  brand: "bg-bg-brand",
  neutral: "bg-text-tertiary",
  blue: "bg-bg-blue",
  success: "bg-bg-success",
  warning: "bg-bg-warning",
  error: "bg-bg-error",
};

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof badgeVariants> {
  /** Leading status dot. Mirrors Figma `Icon=Dot`. */
  dot?: boolean | undefined;
  /** Leading slot — icon, country flag, avatar. Mirrors Figma swap slots. */
  leftIcon?: React.ReactNode | undefined;
  /** Trailing slot. Mirrors `Icon=Icon trailing`. */
  rightIcon?: React.ReactNode | undefined;
  /** Renders an X close button. Mirrors `Icon=X close`. */
  onDismiss?: () => void;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, color, size, dot, leftIcon, rightIcon, onDismiss, children, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, color, size }), className)} {...props}>
      {dot && <span className={cn("size-[6px] rounded-full", dotColor[color ?? "brand"])} aria-hidden="true" />}
      {leftIcon}
      {children}
      {rightIcon}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Remove"
          className="-mr-[2px] inline-flex items-center justify-center rounded-full outline-none hover:opacity-70 focus-visible:shadow-[0_0_0_3px_var(--color-focus-halo)]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </span>
  )
);
Badge.displayName = "Badge";
