import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The design system's class merger, taught this repository's type scale.
 *
 * Written into `packages/ds-ui/src/lib/cn.ts` by
 * `tools/sync-design-system.mjs`, replacing the plain `twMerge` the design
 * repo ships. Do not edit the copy — edit this template.
 *
 * Why it has to be replaced: the vendored components lean on `tailwind-merge`
 * to let a caller's class beat a variant's, and it decides what conflicts by
 * sorting each class into a group. Faced with `text-label-lg` it looks for
 * `label-lg` among Tailwind's own font sizes, does not find it, and concludes
 * the class must be a colour — so merging `text-button-primary-text` with
 * `text-label-lg` drops the colour and keeps the size.
 *
 * That is not hypothetical. It is why every primary button rendered its label
 * in body grey on the brand fill: 1.45:1 in light mode, measured on the page.
 * The design repo cannot know this project's scale, so the names are declared
 * here instead.
 */

/** Every text style this repository's Tailwind preset publishes. */
const FONT_SIZES = [
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

const merge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: FONT_SIZES }] } },
});

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
