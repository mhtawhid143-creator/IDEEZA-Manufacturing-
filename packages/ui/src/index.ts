export { cn, type ClassValue } from './lib/cn.js';
// Re-exported from the domain, where it lives so a server data module can
// format a figure without importing a React package.
export { majorAmount, wholeAmount } from '@ideeza/domain';
// Framework-agnostic, so a server component can style a link like a button.
export {
  buttonAppearance,
  BUTTON_SIZE,
  BUTTON_VARIANT,
  type ButtonAppearance,
  type ButtonSize,
  type ButtonVariant,
} from './lib/button-appearance.js';

export * from './components/icon.js';
export * from './components/typography.js';
export * from './components/button.js';
export * from './components/icon-button.js';
export * from './components/spinner.js';
export * from './components/card.js';
export * from './components/badge.js';
export * from './components/status.js';
export * from './components/form-field.js';
export * from './components/input.js';
export * from './components/select.js';
export * from './components/choice.js';
export * from './components/option-chips.js';
export * from './components/stepper.js';
export * from './components/timeline.js';
export * from './components/tabs.js';
export * from './components/breadcrumbs.js';
export * from './components/dropdown-menu.js';
export * from './components/overlay.js';
export * from './components/tooltip.js';
export * from './components/alert.js';
export * from './components/toast.js';
export * from './components/table.js';
export * from './components/states.js';
export * from './components/layout.js';

// The design system's own components, under `Ds*` names. See ./ds/index.ts for
// why they are prefixed and ./ds/README.md for where they come from.
export * from './ds/index.js';
