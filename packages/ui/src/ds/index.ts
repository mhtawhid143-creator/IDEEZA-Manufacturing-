/**
 * The design system's own components.
 *
 * Copied, not written — see `./README.md` and `tools/sync-design-system.mjs`.
 * Everything here is the system's code expressing the system's Figma specs, so
 * it is the reference when this repository's own component of the same name
 * disagrees.
 *
 * Every name carries a `Ds` prefix. This package already exports a `Badge`, a
 * `Button`, an `Input`, a `Select`, a `Checkbox`, a `Radio` and a `Textarea`,
 * and those names are spoken at hundreds of call sites, so they cannot move.
 * The prefix records that two namespaces met — not which one is authoritative:
 * where a screen has a free choice the `Ds` component is the one to reach for,
 * and where this repository's component stays, it should be rendering the `Ds`
 * one underneath rather than repainting the same spec by hand.
 *
 * Nothing is re-exported with `export *`, deliberately. A star would quietly
 * shadow one of those names the next time the system adds a component, and the
 * failure would be a screen that changed shape rather than a build that broke.
 *
 * The `*Variants` functions come along too: a wrapper often wants the class
 * string without the element, which is how this repository's own `Badge` can
 * hand the system's paint to a `<span>` it already owns.
 */
export {
  Badge as DsBadge,
  badgeVariants as dsBadgeVariants,
  type BadgeProps as DsBadgeProps,
} from './components/Badge/index.js';

export {
  Button as DsButton,
  buttonVariants as dsButtonVariants,
  type ButtonProps as DsButtonProps,
} from './components/Button/index.js';

export {
  IconButton as DsIconButton,
  iconButtonVariants as dsIconButtonVariants,
  type IconButtonProps as DsIconButtonProps,
} from './components/IconButton/index.js';

export {
  Checkbox as DsCheckbox,
  type CheckboxProps as DsCheckboxProps,
  type CheckboxSize as DsCheckboxSize,
} from './components/Checkbox/index.js';

export {
  Radio as DsRadio,
  type RadioProps as DsRadioProps,
  type RadioSize as DsRadioSize,
} from './components/Radio/index.js';

export { Toggle as DsToggle, type ToggleProps as DsToggleProps } from './components/Toggle/index.js';

export {
  Input as DsInput,
  type InputProps as DsInputProps,
  type InputSize as DsInputSize,
} from './components/Input/index.js';

export {
  Textarea as DsTextarea,
  type TextareaProps as DsTextareaProps,
  type TextareaRows as DsTextareaRows,
} from './components/Textarea/index.js';

export {
  Select as DsSelect,
  type SelectProps as DsSelectProps,
  type SelectSize as DsSelectSize,
} from './components/Select/index.js';

/**
 * The field shell every input in the system sits in: label, control frame,
 * helper and error line. Its class helpers are what keep a bespoke control
 * looking like a system control.
 */
export {
  FieldShell as DsFieldShell,
  fieldLabelClass as dsFieldLabelClass,
  fieldRowGap as dsFieldRowGap,
  controlClass as dsControlClass,
  controlChrome as dsControlChrome,
  valueClass as dsValueClass,
  iconClass as dsIconClass,
  type FieldShellProps as DsFieldShellProps,
  type FieldSize as DsFieldSize,
} from './components/Field/index.js';
