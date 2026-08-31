import * as React from "react";

/**
 * Shared wrapper for every generated icon.
 *
 * The Figma library draws all 2,852 icons on a 24 grid with a 1.5 stroke,
 * round cap and join, no fill. Those defaults live here rather than in each
 * icon, so a house-style change is one edit.
 *
 * Colour comes from `currentColor` — set it on the parent, e.g.
 * `<span className="text-icon-default"><Search01 /></span>`.
 *
 * Size defaults to 1em so the icon tracks the surrounding type; pass `size`
 * or a `size-[16px]` class for a fixed box. Stroke width stays 1.5 in the
 * 24 viewBox, so a 16px icon renders a 1px stroke exactly as in Figma.
 */
export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, "children"> {
  /** Width and height. Defaults to `1em`. */
  size?: number | string;
  /** Accessible name. Without it the icon is hidden from assistive tech. */
  title?: string;
  children?: React.ReactNode;
}

export const IconBase = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = "1em", title, children, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
);
IconBase.displayName = "IconBase";
