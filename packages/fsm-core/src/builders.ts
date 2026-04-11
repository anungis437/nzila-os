import type {
  EmittedEvent,
  Guard,
  MachineDefinition,
  ScheduledAction,
  TransitionDef,
} from './types'

/* ─── Transition builder ──────────────────────────────── */

/**
 * Fluent builder for constructing TransitionDef objects.
 *
 * Usage:
 * ```ts
 * transition('draft', 'submitted', 'Submit for review')
 *   .allowRoles('editor', 'admin')
 *   .guard('predicate', 'has_title', (ctx, entity) => !!entity.title)
 *   .emits('article.submitted', {})
 *   .build()
 * ```
 */
export class TransitionBuilder<
  TState extends string,
  TEntity = unknown,
  TRole extends string = string,
> {
  private readonly _from: TState
  private readonly _to: TState
  private readonly _label: string
  private _roles: TRole[] = []
  private _guards: Guard<TState, TEntity, TRole>[] = []
  private _events: EmittedEvent[] = []
  private _actions: ScheduledAction[] = []
  private _timeout: TransitionDef<TState>['timeout']

  constructor(from: TState, to: TState, label: string) {
    this._from = from
    this._to = to
    this._label = label
  }

  allowRoles(...roles: TRole[]): this {
    this._roles.push(...roles)
    return this
  }

  guard(
    kind: 'predicate',
    name: string,
    fn: Guard<TState, TEntity, TRole> extends { kind: 'predicate'; fn: infer F }
      ? F
      : never,
  ): this
  guard(kind: 'named', name: string): this
  guard(
    kind: 'predicate' | 'named',
    name: string,
    fn?: (
      ctx: import('./types').TransitionContext<TRole>,
      entity: TEntity,
      from: TState,
      to: TState,
    ) => boolean,
  ): this {
    if (kind === 'predicate' && fn) {
      this._guards.push({ kind: 'predicate', name, fn })
    } else {
      this._guards.push({ kind: 'named', name })
    }
    return this
  }

  emits(type: string, payload: Record<string, unknown> = {}): this {
    this._events.push({ type, payload })
    return this
  }

  schedules(
    type: string,
    payload: Record<string, unknown> = {},
    delayMs?: number,
  ): this {
    this._actions.push({ type, payload, delayMs })
    return this
  }

  timeout(delayMs: number, targetState: TState): this {
    this._timeout = { delayMs, targetState }
    return this
  }

  build(): TransitionDef<TState, TEntity, TRole> {
    return {
      from: this._from,
      to: this._to,
      label: this._label,
      allowedRoles: this._roles,
      guards: this._guards,
      events: this._events,
      actions: this._actions,
      timeout: this._timeout,
    }
  }
}

/** Shorthand factory for creating a TransitionBuilder. */
export function transition<
  TState extends string,
  TEntity = unknown,
  TRole extends string = string,
>(from: TState, to: TState, label: string): TransitionBuilder<TState, TEntity, TRole> {
  return new TransitionBuilder<TState, TEntity, TRole>(from, to, label)
}

/* ─── Machine builder ─────────────────────────────────── */

/**
 * Fluent builder for constructing MachineDefinition objects.
 *
 * Usage:
 * ```ts
 * machine<MyState>('order', '1.0.0')
 *   .states(['draft', 'submitted', 'approved', 'rejected'])
 *   .initial('draft')
 *   .terminal('approved', 'rejected')
 *   .transition(transition('draft', 'submitted', 'Submit').allowRoles('editor'))
 *   .transition(transition('submitted', 'approved', 'Approve').allowRoles('admin'))
 *   .transition(transition('submitted', 'rejected', 'Reject').allowRoles('admin'))
 *   .build()
 * ```
 */
export class MachineBuilder<
  TState extends string,
  TEntity = unknown,
  TRole extends string = string,
> {
  private readonly _name: string
  private readonly _version: string
  private _states: TState[] = []
  private _initialState!: TState
  private _terminalStates: TState[] = []
  private _transitions: TransitionDef<TState, TEntity, TRole>[] = []

  constructor(name: string, version: string) {
    this._name = name
    this._version = version
  }

  states(states: TState[]): this {
    this._states = states
    return this
  }

  initial(state: TState): this {
    this._initialState = state
    return this
  }

  terminal(...states: TState[]): this {
    this._terminalStates.push(...states)
    return this
  }

  addTransition(
    builder: TransitionBuilder<TState, TEntity, TRole>,
  ): this {
    this._transitions.push(builder.build())
    return this
  }

  addTransitionDef(def: TransitionDef<TState, TEntity, TRole>): this {
    this._transitions.push(def)
    return this
  }

  build(): MachineDefinition<TState, TEntity, TRole> {
    return {
      name: this._name,
      version: this._version,
      states: this._states,
      initialState: this._initialState,
      terminalStates: this._terminalStates,
      transitions: this._transitions,
    }
  }
}

/** Shorthand factory for creating a MachineBuilder. */
export function machine<
  TState extends string,
  TEntity = unknown,
  TRole extends string = string,
>(name: string, version: string): MachineBuilder<TState, TEntity, TRole> {
  return new MachineBuilder<TState, TEntity, TRole>(name, version)
}
