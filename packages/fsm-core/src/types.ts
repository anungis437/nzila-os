/**
 * @nzila/fsm-core — Generic finite-state machine engine.
 *
 * Extracted from @nzila/commerce-state (graph-based) and
 * @nzila/mobility-case-engine (linear lifecycle). Provides:
 *
 * - Declarative machine definitions (states, transitions, guards)
 * - Role-based + predicate guards
 * - Org-scope isolation (built-in)
 * - Event + action emission on transitions
 * - Time-based auto-transitions
 * - Transition audit trail
 * - Machine validation
 */

/* ─── Context ─────────────────────────────────────────── */

/** Immutable context supplied to every transition attempt. */
export interface TransitionContext<TRole extends string = string> {
  readonly orgId: string
  readonly actorId: string
  readonly role: TRole
  readonly meta: Readonly<Record<string, unknown>>
}

/* ─── Guards ──────────────────────────────────────────── */

/**
 * A guard is either an inline predicate evaluated by the engine,
 * or a named reference resolved by the consumer via a GuardResolver.
 */
export type Guard<
  TState extends string = string,
  TEntity = unknown,
  TRole extends string = string,
> =
  | {
      readonly kind: 'predicate'
      readonly name: string
      readonly fn: (
        ctx: TransitionContext<TRole>,
        entity: TEntity,
        from: TState,
        to: TState,
      ) => boolean
    }
  | {
      readonly kind: 'named'
      readonly name: string
    }

/** Resolves named guards at transition time. */
export type GuardResolver<
  TState extends string = string,
  TEntity = unknown,
  TRole extends string = string,
> = (
  name: string,
  ctx: TransitionContext<TRole>,
  entity: TEntity,
  from: TState,
  to: TState,
) => boolean

/* ─── Events & actions ────────────────────────────────── */

/** Domain event emitted on a successful transition. */
export interface EmittedEvent {
  readonly type: string
  readonly payload: Readonly<Record<string, unknown>>
}

/** Side-effect action scheduled on a successful transition. */
export interface ScheduledAction {
  readonly type: string
  readonly payload: Readonly<Record<string, unknown>>
  readonly delayMs?: number
}

/* ─── Transitions ─────────────────────────────────────── */

/** A single declarative transition definition. */
export interface TransitionDef<
  TState extends string = string,
  TEntity = unknown,
  TRole extends string = string,
> {
  readonly from: TState
  readonly to: TState
  readonly label: string
  readonly allowedRoles: readonly TRole[]
  readonly guards: readonly Guard<TState, TEntity, TRole>[]
  readonly events: readonly EmittedEvent[]
  readonly actions: readonly ScheduledAction[]
  readonly timeout?: {
    readonly delayMs: number
    readonly targetState: TState
  }
}

/* ─── Machine definition ──────────────────────────────── */

/** Complete, immutable state-machine definition. */
export interface MachineDefinition<
  TState extends string = string,
  TEntity = unknown,
  TRole extends string = string,
> {
  readonly name: string
  readonly version: string
  readonly states: readonly TState[]
  readonly initialState: TState
  readonly terminalStates: readonly TState[]
  readonly transitions: readonly TransitionDef<TState, TEntity, TRole>[]
}

/* ─── Transition result ───────────────────────────────── */

export interface TransitionSuccess<TState extends string = string> {
  readonly ok: true
  readonly from: TState
  readonly to: TState
  readonly label: string
  readonly eventsToEmit: readonly EmittedEvent[]
  readonly actionsToSchedule: readonly ScheduledAction[]
  readonly timeout: TransitionDef<TState>['timeout'] | undefined
}

export type TransitionFailureCode =
  | 'INVALID_TRANSITION'
  | 'GUARD_FAILED'
  | 'ROLE_DENIED'
  | 'ORG_MISMATCH'
  | 'TERMINAL_STATE'

export interface TransitionFailure {
  readonly ok: false
  readonly reason: string
  readonly code: TransitionFailureCode
}

export type TransitionResult<TState extends string = string> =
  | TransitionSuccess<TState>
  | TransitionFailure

/* ─── Transition record (audit) ───────────────────────── */

/** Persisted record of a completed transition. */
export interface TransitionRecord<TState extends string = string> {
  readonly transitionId: string
  readonly machineName: string
  readonly machineVersion: string
  readonly entityId: string
  readonly orgId: string
  readonly from: TState
  readonly to: TState
  readonly label: string
  readonly actorId: string
  readonly timestamp: string
  readonly reason: string
  readonly durationMs: number
}
