import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn.js";

/**
 * IconButton — mirrors Figma `A02 Icon Button` (Atoms — Action), 80 variants.
 * Square icon-only button. `aria-label` is required for accessibility.
 *
 * Figma geometry (Hierarchy: Primary / Secondary / Ghost / Danger):
 *   32 · radius/md  6 · icon 16
 *   36 · radius/lg  8 · icon 18
 *   40 · radius/lg  8 · icon 20
 *   44 · radius/xl 12 · icon 22
 *   48 · radius/xl 12 · icon 24
 *
 * Sizes are named by their pixel height to match Figma exactly — A02 uses a
 * different radius ramp from A01 Button, so reusing sm/md/lg here would be
 * misleading.
 *
 * Note: A02 has no `Focus` state in Figma. The halo below is the repo's own
 * addition so keyboard users are not stranded; keep it until Figma catches up.
 */
export const iconButtonVariants = cva(
  [
    "inline-flex items-center justify-center shrink-0 select-none",
    "[--bd:0px]",
    "transition-[colors,box-shadow] duration-fast ease-standard",
    "outline-none focus-visible:shadow-[0_0_0_3px_var(--color-focus-halo)]",
    "disabled:pointer-events-none disabled:shadow-none",
    "disabled:bg-button-disabled-bg disabled:text-button-disabled-text disabled:border-transparent",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-button-primary-bg text-button-primary-text shadow-depth-accent",
          "hover:bg-button-primary-bg-hover active:bg-button-primary-bg-pressed",
          "focus-visible:shadow-[var(--shadow-depth-accent),0_0_0_3px_var(--color-focus-halo-on-fill)]",
        ],
        secondary: [
          "bg-button-secondary-bg text-button-secondary-text",
          "border-solid border-[1.5px] border-button-secondary-border [--bd:1.5px]",
          "hover:bg-button-secondary-bg-hover hover:border-button-secondary-border-hover",
          "active:bg-button-secondary-bg-pressed",
        ],
        ghost: [
          "bg-transparent text-icon-default",
          "hover:bg-button-ghost-bg-hover hover:text-text-primary",
          "active:bg-bg-surface-raised",
        ],
        danger: [
          "bg-button-danger-bg text-button-danger-text shadow-depth-accent",
          "hover:bg-button-danger-bg-hover active:bg-button-danger-bg-pressed",
          "focus-visible:shadow-[var(--shadow-depth-accent),0_0_0_3px_var(--color-focus-halo-danger)]",
        ],
      },
      size: {
        32: "size-[32px] rounded-[6px] [&_svg]:size-[16px]",
        36: "size-[36px] rounded-[8px] [&_svg]:size-[18px]",
        40: "size-[40px] rounded-[8px] [&_svg]:size-[20px]",
        44: "size-[44px] rounded-[12px] [&_svg]:size-[22px]",
        48: "size-[48px] rounded-[12px] [&_svg]:size-[24px]",
      },
    },
    defaultVariants: { variant: "ghost", size: 40 },
  }
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /** Accessible name — required since there is no visible label. */
  "aria-label": string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => (
    <button ref={ref} className={cn(iconButtonVariants({ variant, size }), className)} {...props}>
      {children}
    </button>
  )
);
IconButton.displayName = "IconButton";
