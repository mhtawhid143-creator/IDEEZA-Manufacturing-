/**
 * The glyphs the design system's components ask for.
 *
 * Those components import from `@ideeza/icons`, the system's own package, which
 * is generated from the Figma icon library. That library is Hugeicons, which
 * this repository already installs and already draws every other icon from — so
 * the same shapes are served here rather than adding a second copy of the same
 * set under a different name. `tools/sync-design-system.mjs` points the copied
 * components at this file.
 *
 * The system's components call these as plain components, so each name is a
 * small wrapper rather than a re-export: the icon set exposes shape data, and
 * `HugeiconsIcon` turns it into an element.
 *
 * Only the names those components actually import belong here. Adding an unused
 * one is a promise nothing keeps.
 */
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  HelpCircleIcon,
  InformationCircleIcon,
  Remove01Icon,
  Search01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';

/**
 * A class is the only thing the system's components pass, and it is how they
 * size and colour the glyph — `[&_svg]:size-[14px]`, `text-icon-on-brand`. The
 * type says exactly that rather than the whole SVG surface, so an accidental
 * `width` or `fill` at a call site is a build error instead of a silent
 * override of what the system decided.
 */
export interface IconProps {
  readonly className?: string;
}

type Shape = Parameters<typeof HugeiconsIcon>[0]['icon'];

/**
 * No `size` is passed: the components size their slots with a class, and a CSS
 * width beats the SVG's own width attribute, so the class wins whatever default
 * the icon set applies. The class itself is handed over only when there is one,
 * because the set declares the prop as `className?: string` and under
 * `exactOptionalPropertyTypes` an explicit `undefined` is not that type.
 */
const glyph = (icon: Shape, displayName: string) => {
  const Glyph = ({ className }: IconProps) =>
    className === undefined ? (
      <HugeiconsIcon icon={icon} />
    ) : (
      <HugeiconsIcon icon={icon} className={className} />
    );
  Glyph.displayName = displayName;
  return Glyph;
};

export const ChevronDown = glyph(ArrowDown01Icon, 'ChevronDown');
export const ChevronUp = glyph(ArrowUp01Icon, 'ChevronUp');
export const Check = glyph(Tick02Icon, 'Check');
export const Minus = glyph(Remove01Icon, 'Minus');
export const Plus = glyph(Add01Icon, 'Plus');
export const Close = glyph(Cancel01Icon, 'Close');
export const Search = glyph(Search01Icon, 'Search');
export const AlertCircle = glyph(AlertCircleIcon, 'AlertCircle');
export const HelpCircle = glyph(HelpCircleIcon, 'HelpCircle');
export const InformationCircle = glyph(InformationCircleIcon, 'InformationCircle');
