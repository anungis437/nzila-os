/**
 * @nzila/commerce-state — fsm-core compatibility bridge
 *
 * Converts commerce-state machine definitions (which use plain
 * guard functions) to @nzila/fsm-core MachineDefinition format
 * (which uses tagged guard unions).
 *
 * This allows consumers to use fsm-core's attemptTransition,
 * getAvailableTransitions, validateMachine, registry, and
 * builders with existing commerce-state machines.
 *
 * @module @nzila/commerce-state/compat
 */
import type {
  MachineDefinition as FsmMachine,
  TransitionDef as FsmTransition,
  Guard as FsmGuard,
} from '@nzila/fsm-core'
import type {
  MachineDefinition as CommerceMachine,
  TransitionDef as CommerceTransition,
} from './engine'

/**
 * Convert a commerce-state machine definition to fsm-core format.
 *
 * Guards are wrapped as `{ kind: 'predicate', name, fn }`.
 * All other fields map 1:1.
 */
export function toFsmCoreMachine<
  TState extends string,
  TEntity = unknown,
  TRole extends string = string,
>(
  source: CommerceMachine<TState, TEntity, TRole>,
): FsmMachine<TState, TEntity, TRole> {
  return {
    name: source.name,
    version: '1.0.0',
    states: source.states,
    initialState: source.initialState,
    terminalStates: source.terminalStates,
    transitions: source.transitions.map((t, i) =>
      convertTransition(t, i),
    ),
  }
}

function convertTransition<
  TState extends string,
  TEntity = unknown,
  TRole extends string = string,
>(
  source: CommerceTransition<TState, TEntity, TRole>,
  index: number,
): FsmTransition<TState, TEntity, TRole> {
  const guards: FsmGuard<TState, TEntity, TRole>[] = source.guards.map(
    (fn, gi) => ({
      kind: 'predicate' as const,
      name: `guard_${index}_${gi}`,
      fn,
    }),
  )

  return {
    from: source.from,
    to: source.to,
    label: source.label,
    allowedRoles: source.allowedRoles,
    guards,
    events: source.events,
    actions: source.actions,
    timeout: source.timeout,
  }
}
