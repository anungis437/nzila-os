/**
 * @nzila/commerce-state — Declarative State Machine Engine
 *
 * Transitions are data, not if/else logic. The machine definition is a
 * plain object describing all valid transitions, guards, roles, events,
 * and scheduled actions. The engine evaluates this data to produce a
 * deterministic result — no side effects.
 *
 * KEY DESIGN RULES (from STATE_MACHINE_GAP.md):
 * 1. Transitions defined as data (declarative)
 * 2. Guards: pure predicates evaluated before transition
 * 3. Role checks: array of allowed OrgRole values
 * 4. Org match: entityId must match on context
 * 5. Produces eventsToEmit[] + actionsToSchedule[] (no inline side effects)
 * 6. Audit: every transition produces an AuditEvent-compatible record
 *
 * @module @nzila/commerce-state
 */
import type { OrgRole } from '@nzila/commerce-core/enums'

// ── Core Types ──────────────────────────────────────────────────────────────

/**
 * Context passed to every transition attempt.
 * Carries org identity, actor, and arbitrary metadata for guards.
 */
export interface TransitionContext<TRole extends string = OrgRole> {
  /** The org this resource belongs to */
  readonly entityId: string
  /** The actor attempting the transition */
  readonly actorId: string
  /** Actor's role within the org */
  readonly role: TRole
  /** Arbitrary metadata available to guards */
  readonly meta: Readonly<Record<string, unknown>>
}

/** Pure predicate — receives context + current entity, returns boolean */
export type Guard<TState extends string, TEntity = unknown, TRole extends string = OrgRole> = (
  ctx: TransitionContext<TRole>,
  entity: TEntity,
  from: TState,
  to: TState,
) => boolean

/** Event to be emitted after a successful transition */
export interface EmittedEvent {
  readonly type: string
  readonly payload: Readonly<Record<string, unknown>>
}

/** Action to be scheduled after a successful transition */
export interface ScheduledAction {
  readonly type: string
  readonly payload: Readonly<Record<string, unknown>>
  readonly delayMs?: number
}

/** A single declarative transition definition */
export interface TransitionDef<TState extends string, TEntity = unknown, TRole extends string = OrgRole> {
  /** Source state */
  readonly from: TState
  /** Target state */
  readonly to: TState
  /** Roles allowed to perform this transition (empty = any role) */
  readonly allowedRoles: readonly TRole[]
  /** Guard predicates — ALL must pass for transition to proceed */
  readonly guards: readonly Guard<TState, TEntity, TRole>[]
  /** Events to emit when this transition succeeds */
  readonly events: readonly EmittedEvent[]
  /** Actions to schedule when this transition succeeds */
  readonly actions: readonly ScheduledAction[]
  /** Human-readable label for audit trail */
  readonly label: string
  /** Optional timeout: auto-transition after delayMs if no other transition occurs */
  readonly timeout?: {
    readonly delayMs: number
    readonly targetState: TState
  }
}

/** Complete state machine definition — pure data */
export interface MachineDefinition<TState extends string, TEntity = unknown, TRole extends string = OrgRole> {
  /** Unique machine name (e.g. 'quote', 'order') */
  readonly name: string
  /** All possible states */
  readonly states: readonly TState[]
  /** Initial state for new entities */
  readonly initialState: TState
  /** Terminal states (no transitions out) */
  readonly terminalStates: readonly TState[]
  /** All valid transitions */
  readonly transitions: readonly TransitionDef<TState, TEntity, TRole>[]
}

/** Result of a successful transition */
export interface TransitionSuccess<TState extends string> {
  readonly ok: true
  readonly from: TState
  readonly to: TState
  readonly label: string
  readonly eventsToEmit: readonly EmittedEvent[]
  readonly actionsToSchedule: readonly ScheduledAction[]
  readonly timeout: TransitionDef<TState>['timeout'] | undefined
}

/** Result of a failed transition */
export interface TransitionFailure {
  readonly ok: false
  readonly reason: string
  readonly code:
    | 'INVALID_TRANSITION'
    | 'GUARD_FAILED'
    | 'ROLE_DENIED'
    | 'ORG_MISMATCH'
    | 'TERMINAL_STATE'
}

export type TransitionResult<TState extends string> =
  | TransitionSuccess<TState>
  | TransitionFailure

// ── Engine ──────────────────────────────────────────────────────────────────

/**
 * Attempt a state transition. Pure function — no side effects.
 *
 * Evaluation order:
 * 1. Check: is current state terminal?
 * 2. Find matching transition definition (from → to)
 * 3. Check: org match (entityId in context === entityId on resource)
 * 4. Check: role allowed
 * 5. Evaluate: all guard predicates
 * 6. Return: success with events + actions, or failure with reason
 */
export function attemptTransition<TState extends string, TEntity = unknown, TRole extends string = OrgRole>(
  machine: MachineDefinition<TState, TEntity, TRole>,
  currentState: TState,
  targetState: TState,
  ctx: TransitionContext<TRole>,
  resourceEntityId: string,
  entity: TEntity,
): TransitionResult<TState> {
  // 1. Terminal state check
  if (machine.terminalStates.includes(currentState)) {
    return {
      ok: false,
      reason: `State "${currentState}" is terminal — no transitions allowed`,
      code: 'TERMINAL_STATE',
    }
  }

  // 2. Find transition definition
  const transition = machine.transitions.find(
    (t) => t.from === currentState && t.to === targetState,
  )
  if (!transition) {
    return {
      ok: false,
      reason: `No transition defined from "${currentState}" to "${targetState}" in machine "${machine.name}"`,
      code: 'INVALID_TRANSITION',
    }
  }

  // 3. Org match
  if (ctx.entityId !== resourceEntityId) {
    return {
      ok: false,
      reason: `Org mismatch: actor org "${ctx.entityId}" ≠ resource org "${resourceEntityId}"`,
      code: 'ORG_MISMATCH',
    }
  }

  // 4. Role check
  if (transition.allowedRoles.length > 0 && !transition.allowedRoles.includes(ctx.role)) {
    return {
      ok: false,
      reason: `Role "${ctx.role}" not allowed for transition "${transition.label}". Allowed: ${transition.allowedRoles.join(', ')}`,
      code: 'ROLE_DENIED',
    }
  }

  // 5. Guard evaluation
  for (const guard of transition.guards) {
    if (!guard(ctx, entity, currentState, targetState)) {
      return {
        ok: false,
        reason: `Guard failed for transition "${transition.label}" (${currentState} → ${targetState})`,
        code: 'GUARD_FAILED',
      }
    }
  }

  // 6. Success
  return {
    ok: true,
    from: currentState,
    to: targetState,
    label: transition.label,
    eventsToEmit: transition.events,
    actionsToSchedule: transition.actions,
    timeout: transition.timeout,
  }
}

/**
 * Get all valid target states from the current state for a given context.
 * Useful for UI: "what buttons should we show?"
 */
export function getAvailableTransitions<TState extends string, TEntity = unknown, TRole extends string = OrgRole>(
  machine: MachineDefinition<TState, TEntity, TRole>,
  currentState: TState,
  ctx: TransitionContext<TRole>,
  resourceEntityId: string,
  entity: TEntity,
): readonly TransitionDef<TState, TEntity, TRole>[] {
  if (machine.terminalStates.includes(currentState)) return []
  if (ctx.entityId !== resourceEntityId) return []

  return machine.transitions.filter((t) => {
    if (t.from !== currentState) return false
    if (t.allowedRoles.length > 0 && !t.allowedRoles.includes(ctx.role)) return false
    return t.guards.every((g) => g(ctx, entity, currentState, t.to))
  })
}

/**
 * Validate a machine definition for internal consistency.
 * Useful in contract tests and CI.
 */
export function validateMachine<TState extends string, TEntity = unknown, TRole extends string = OrgRole>(
  machine: MachineDefinition<TState, TEntity, TRole>,
): string[] {
  const errors: string[] = []
  const stateSet = new Set<string>(machine.states)

  // Initial state must be valid
  if (!stateSet.has(machine.initialState)) {
    errors.push(`initialState "${machine.initialState}" is not in states list`)
  }

  // Terminal states must be valid
  for (const t of machine.terminalStates) {
    if (!stateSet.has(t)) {
      errors.push(`terminalState "${t}" is not in states list`)
    }
  }

  // All transitions must reference valid states
  for (const tr of machine.transitions) {
    if (!stateSet.has(tr.from)) {
      errors.push(`Transition "${tr.label}": from state "${tr.from}" not in states list`)
    }
    if (!stateSet.has(tr.to)) {
      errors.push(`Transition "${tr.label}": to state "${tr.to}" not in states list`)
    }
  }

  // No transitions should originate from terminal states
  for (const tr of machine.transitions) {
    if (machine.terminalStates.includes(tr.from as TState)) {
      errors.push(`Transition "${tr.label}" originates from terminal state "${tr.from}"`)
    }
  }

  // Every non-terminal state should have at least one transition out
  for (const state of machine.states) {
    if (machine.terminalStates.includes(state)) continue
    const hasTransitionOut = machine.transitions.some((t) => t.from === state)
    if (!hasTransitionOut) {
      errors.push(`Non-terminal state "${state}" has no outgoing transitions (dead state)`)
    }
  }

  return errors
}
