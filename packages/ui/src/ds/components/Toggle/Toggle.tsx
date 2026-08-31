import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from '../../../lib/ds-cn.js';

/**
 * Toggle — mirrors Figma `A10 Toggle` (Atoms — Input).
 * iOS-style switch built on Radix Switch (keyboard + ARIA for free).
 *
 * Figma variant map:
 * - Pressed=On/Off → `checked` / `defaultChecked`
 * - State Default/Hover/Focused/Disabled → pseudo-classes + `disabled`
 * - Text=On/Off label → compose externally with a <label>
 */
const trackVariants = cva(
  [
    "peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full",
    "transition-colors duration-fast ease-standard",
    "outline-none focus-visible:shadow-[0_0_0_3px_var(--color-focus-halo)]",
    "bg-bg-surface-raised data-[state=checked]:bg-bg-brand",
    "border border-border data-[state=checked]:border-transparent",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ],
  {
    variants: {
      size: {
        sm: "h-[20px] w-[36px]",
        md: "h-[24px] w-[44px]",
      },
    },
    defaultVariants: { size: "md" },
  }
);

const thumbVariants = cva(
  [
    "pointer-events-none block rounded-full bg-white shadow-1",
    "transition-transform duration-fast ease-standard translate-x-[2px]",
  ],
  {
    variants: {
      size: {
        sm: "size-[16px] data-[state=checked]:translate-x-[18px]",
        md: "size-[20px] data-[state=checked]:translate-x-[22px]",
      },
    },
    defaultVariants: { size: "md" },
  }
);

export interface ToggleProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
    VariantProps<typeof trackVariants> {}

export const Toggle = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  ToggleProps
>(({ className, size, ...props }, ref) => (
  <SwitchPrimitive.Root ref={ref} className={cn(trackVariants({ size }), className)} {...props}>
    <SwitchPrimitive.Thumb className={cn(thumbVariants({ size }))} />
  </SwitchPrimitive.Root>
));
Toggle.displayName = "Toggle";
