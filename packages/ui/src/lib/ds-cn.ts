import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Class merging for the design system's copied components.
 *
 * Those components rely on conflict resolution: a variant sets `px-[8px]` and a
 * caller's `px-4` has to replace it rather than sit beside it and lose to
 * whichever rule the stylesheet happens to define later. `tailwind-merge` does
 * that by sorting every class into a group and keeping the last of each group.
 *
 * It has to be told about this project's scales, though, and the failure when it
 * is not told is silent. Faced with `text-label-md` it looks for `label-md` in
 * Tailwind's own font-size scale, does not find it, and concludes the class must
 * be a colour — so `cn("text-label-md", "text-text-brand")` drops the type style
 * and keeps only the colour. That is exactly what happened to the status badge:
 * the pill kept its colours and lost its 14px semibold, and read as body text in
 * a coloured lozenge.
 *
 * The two lists below are the system's own names, so a style and a colour are
 * understood as the different things they are.
 */

/** Every text style and size this project's preset publishes. */
const FONT_SIZES = [
  // The system's Figma text styles.
  'display-xl',
  'display-lg',
  'display-md',
  'heading-h1',
  'heading-h2',
  'heading-h3',
  'heading-h4',
  'heading-h5',
  'heading-h6',
  'body-xs',
  'body-sm',
  'body-md',
  'body-lg',
  'body-xl',
  'body-xs-medium',
  'body-sm-medium',
  'body-md-medium',
  'body-lg-medium',
  'body-xl-medium',
  'label-xl',
  'label-lg',
  'label-md',
  'label-sm',
  'caption-md',
  'caption-sm',
  'overline-md',
  'overline-sm',
  'code-md',
  'code-sm',
  // The two steps below Tailwind's own smallest, which it does not know.
  '3xs',
  '2xs',
];

/**
 * The semantic colour families. `text-text-brand` and `text-icon-error` are
 * colours; without this they are guessed at, and a guess that lands on
 * font-size would drop a colour instead.
 */
const TEXT_COLOURS = [
  'text-primary',
  'text-secondary',
  'text-tertiary',
  'text-disabled',
  'text-inverse',
  'text-on-brand',
  'text-brand',
  'text-brand-hover',
  'text-link',
  'text-success',
  'text-warning',
  'text-error',
  'text-error-hover',
  'text-blue',
  'text-info',
  'text-ai',
];

const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: FONT_SIZES }],
      'text-color': [{ text: TEXT_COLOURS }],
    },
  },
});

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
