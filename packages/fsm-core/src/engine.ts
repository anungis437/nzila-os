import type {
  Guard,
  GuardResolver,
  MachineDefinition,
  TransitionContext,
  TransitionDef,
  TransitionResult,
} from './types'

/* ─── attemptTransition ───────────────────────────────── */

/**
 * Evaluate a state transition against the machine definition.
 *
 * Returns a success envelope (with events/actions to dispatch)
 * or a typed failure with reason code.
 *
 * Pure function — no side-effects, no I/O.
 */
export function attemptTransition<
  TState extends string,
  TEntity = unknown,
  TRole extends string = string,
>(
  machine: MachineDefinition<TState, TEntity, TRole>,
  currentState: TState,
  targetState: TState,
  ctx: TransitionContext<TRole>,
  resourceOrgId: string,
  entity: TEntity,
  guardResolver?: GuardResolver<TState, TEntity, TRole>,
): TransitionResult<TState> {
  // 1. Terminal-state check
  if (machine.terminalStates.includes(currentState)) {
    return {
      ok: false,
      reason: `State "${currentState}" is terminal — no transitions allowed`,
      code: 'TERMINAL_STATE',
    }
  }

  // 2. Find matching transition definition
  const transition = machine.transitions.find(
    (t) => t.from === currentState && t.to === targetState,
  )
  if (!transition) {
    return {
      ok: false,
      reason: `No transition from "${currentState}" to "${targetState}" in machine "${machine.name}"`,
      code: 'INVALID_TRANSITION',
    }
  }

  // 3. Org-scope isolation
  if (ctx.orgId !== resourceOrgId) {
    return {
      ok: false,
      reason: `Org mismatch: actor org "${ctx.orgId}" ≠ resource org "${resourceOrgId}"`,
      code: 'ORG_MISMATCH',
    }
  }

  // 4. Role check
  if (
    transition.allowedRoles.length > 0 &&
    !transition.allowedRoles.includes(ctx.role)
  ) {
    return {
      ok: false,
      reason: `Role "${ctx.role}" not allowed for "${transition.label}". Allowed: ${transition.allowedRoles.join(', ')}`,
      code: 'ROLE_DENIED',
    }
  }

  // 5. Guard evaluation
  const guardFailure = evaluateGuards(
    transition.guards,
    ctx,
    entity,
    currentState,
    targetState,
    transition.label,
    guardResolver,
  )
  if (guardFailure) return guardFailure

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

/* ─── getAvailableTransitions ─────────────────────────── */

/**
 * Return all transitions available from `currentState`
 * for the given context/entity. Useful for UI rendering.
 */
export function getAvailableTransitions<
  TState extends string,
  TEntity = unknown,
  TRole extends string = string,
>(
  machine: MachineDefinition<TState, TEntity, TRole>,
  currentState: TState,
  ctx: TransitionContext<TRole>,
  resourceOrgId: string,
  entity: TEntity,
  guardResolver?: GuardResolver<TState, TEntity, TRole>,
): readonly TransitionDef<TState, TEntity, TRole>[] {
  if (machine.terminalStates.includes(currentState)) return []
  if (ctx.orgId !== resourceOrgId) return []

  return machine.transitions.filter((t) => {
    if (t.from !== currentState) return false
    if (t.allowedRoles.length > 0 && !t.allowedRoles.includes(ctx.role)) {
      return false
    }
    return !evaluateGuards(
      t.guards,
      ctx,
      entity,
      currentState,
      t.to,
      t.label,
      guardResolver,
    )
  })
}

/* ─── validateMachine ─────────────────────────────────── */

/**
 * Validate a machine definition for structural integrity.
 * Returns an array of error messages (empty = valid).
 */
export function validateMachine<
  TState extends string,
  TEntity = unknown,
  TRole extends string = string,
>(machine: MachineDefinition<TState, TEntity, TRole>): string[] {
  const errors: string[] = []
  const stateSet = new Set<string>(machine.states)

  if (!stateSet.has(machine.initialState)) {
    errors.push(`initialState "${machine.initialState}" is not in states list`)
  }

  for (const t of machine.terminalStates) {
    if (!stateSet.has(t)) {
      errors.push(`terminalState "${t}" is not in states list`)
    }
  }

  for (const tr of machine.transitions) {
    if (!stateSet.has(tr.from)) {
      errors.push(
        `Transition "${tr.label}": from state "${tr.from}" not in states list`,
      )
    }
    if (!stateSet.has(tr.to)) {
      errors.push(
        `Transition "${tr.label}": to state "${tr.to}" not in states list`,
      )
    }
  }

  for (const tr of machine.transitions) {
    if (machine.terminalStates.includes(tr.from as TState)) {
      errors.push(
        `Transition "${tr.label}" originates from terminal state "${tr.from}"`,
      )
    }
  }

  for (const state of machine.states) {
    if (machine.terminalStates.includes(state)) continue
    const hasOut = machine.transitions.some((t) => t.from === state)
    if (!hasOut) {
      errors.push(
        `Non-terminal state "${state}" has no outgoing transitions (dead state)`,
      )
    }
  }

  if (machine.transitions.length === 0) {
    errors.push('Machine has no transitions')
  }

  return errors
}

/* ─── Internal helpers ────────────────────────────────── */

function evaluateGuards<
  TState extends string,
  TEntity,
  TRole extends string,
>(
  guards: readonly Guard<TState, TEntity, TRole>[],
  ctx: TransitionContext<TRole>,
  entity: TEntity,
  from: TState,
  to: TState,
  label: string,
  resolver?: GuardResolver<TState, TEntity, TRole>,
): TransitionResult<TState> | null {
  for (const guard of guards) {
    let passed: boolean

    if (guard.kind === 'predicate') {
      passed = guard.fn(ctx, entity, from, to)
    } else {
      if (!resolver) {
        return {
          ok: false,
          reason: `Named guard "${guard.name}" on "${label}" requires a GuardResolver but none was provided`,
          code: 'GUARD_FAILED',
        }
      }
      passed = resolver(guard.name, ctx, entity, from, to)
    }

    if (!passed) {
      return {
        ok: false,
        reason: `Guard "${guard.name}" failed for transition "${label}" (${from} → ${to})`,
        code: 'GUARD_FAILED',
      }
    }
  }

  return null // all guards passed
}
