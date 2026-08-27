import type { StepperStep } from '@ideeza/ui';

/** The three steps the design's stepper shows, in order. */
export const CHECKOUT_STEPS: readonly StepperStep[] = Object.freeze([
  { id: 'confirm', label: 'Confirm', description: 'Scope, shipping, total' },
  { id: 'payment', label: 'Payment', description: 'How the funds are held' },
  { id: 'done', label: 'Done', description: 'Order confirmed' },
]);
