import { InvalidTransitionError } from '../errors.js';

/**
 * A guard returns null when the transition may proceed, or a human-readable
 * reason when a business rule blocks it.
 */
export type TransitionGuard<TState extends string, TContext> = (
  context: TContext,
  from: TState,
  to: TState,
) => string | null;

export interface StateMachine<TState extends string, TContext = undefined> {
  readonly name: string;
  readonly initial: TState;
  readonly states: readonly TState[];
  readonly transitions: Readonly<Record<TState, readonly TState[]>>;
  readonly terminal: readonly TState[];
  /** Guards keyed by the target state they protect. */
  readonly guards?: Readonly<Partial<Record<TState, readonly TransitionGuard<TState, TContext>[]>>>;
}

export interface TransitionVerdict {
  readonly allowed: boolean;
  readonly reason?: string;
}

const listed = <TState extends string>(
  machine: StateMachine<TState, never>,
  from: TState,
): readonly TState[] => machine.transitions[from] ?? [];

export const nextStates = <TState extends string, TContext>(
  machine: StateMachine<TState, TContext>,
  from: TState,
): readonly TState[] => listed(machine as StateMachine<TState, never>, from);

export const isTerminal = <TState extends string, TContext>(
  machine: StateMachine<TState, TContext>,
  state: TState,
): boolean => machine.terminal.includes(state);

/**
 * Explains whether a transition is allowed. Structural validity is checked
 * first, then every guard registered for the target state.
 */
export const explainTransition = <TState extends string, TContext>(
  machine: StateMachine<TState, TContext>,
  from: TState,
  to: TState,
  context: TContext,
): TransitionVerdict => {
  if (!machine.states.includes(from)) {
    return { allowed: false, reason: `unknown source state "${from}"` };
  }
  if (!machine.states.includes(to)) {
    return { allowed: false, reason: `unknown target state "${to}"` };
  }
  if (!nextStates(machine, from).includes(to)) {
    return { allowed: false, reason: 'transition is not part of the lifecycle' };
  }
  const guards = machine.guards?.[to] ?? [];
  for (const guard of guards) {
    const reason = guard(context, from, to);
    if (reason !== null) return { allowed: false, reason };
  }
  return { allowed: true };
};

export const canTransition = <TState extends string, TContext>(
  machine: StateMachine<TState, TContext>,
  from: TState,
  to: TState,
  context: TContext,
): boolean => explainTransition(machine, from, to, context).allowed;

/**
 * The only sanctioned way to change a status.
 *
 * Callers never assign a status directly; they ask a machine for the next state
 * so that an arbitrary status update is not expressible in the domain layer.
 */
export const applyTransition = <TState extends string, TContext>(
  machine: StateMachine<TState, TContext>,
  from: TState,
  to: TState,
  context: TContext,
): TState => {
  const verdict = explainTransition(machine, from, to, context);
  if (!verdict.allowed) {
    throw new InvalidTransitionError(machine.name, from, to, verdict.reason);
  }
  return to;
};
