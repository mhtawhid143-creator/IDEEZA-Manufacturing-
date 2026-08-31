import { buttonVariants } from '@ideeza/ds/button';
import { cn } from '@ideeza/ds/cn';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tonal'
  | 'ghost'
  | 'outline'
  | 'danger';

/** Figma button heights: 32, 36, 40, 44, 48. */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * This repository's size names against the system's: they name the same five
 * Figma heights, one step apart — our `xs` is the system's `SM` (32px), our
 * `xl` its `2XL` (48px). The names stay because every screen is written in
 * them; the classes come from the system.
 */
const DS_SIZE: Record<ButtonSize, 'sm' | 'md' | 'lg' | 'xl' | '2xl'> = {
  xs: 'sm',
  sm: 'md',
  md: 'lg',
  lg: 'xl',
  xl: '2xl',
};

export interface ButtonAppearance {
  readonly variant?: ButtonVariant | undefined;
  readonly size?: ButtonSize | undefined;
  readonly fullWidth?: boolean | undefined;
  /**
   * The control is shown but has nothing behind it — a link with no
   * destination, an action this build cannot perform. It replaces the variant
   * colours rather than being layered over them.
   */
  readonly unavailable?: boolean | undefined;
  readonly className?: string | undefined;
}

/** A control that is shown but cannot be used: readable, and obviously inert. */
const UNAVAILABLE =
  'cursor-not-allowed bg-bg-subtle text-text-secondary shadow-none hover:bg-bg-subtle active:bg-bg-subtle';

/**
 * The button's look, without the button.
 *
 * The classes are the design system's own — `buttonVariants` from the vendored
 * `@ideeza/ds` package (A01 Button) — so a link dressed as a button and the
 * Button component wear literally the same code. It lives outside the
 * component on purpose: a link that navigates must stay an anchor, and a
 * server component may not render a client component but may reuse its
 * classes. The subpath import keeps the server's module graph on the button
 * alone. `unavailable` is this repository's own state, layered over a ghost
 * base with the system's own class merger so its colours win.
 */
export const buttonAppearance = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  unavailable = false,
  className,
}: ButtonAppearance = {}): string =>
  cn(
    buttonVariants({ variant: unavailable ? 'ghost' : variant, size: DS_SIZE[size] }),
    unavailable && UNAVAILABLE,
    fullWidth && 'w-full',
    className,
  );
