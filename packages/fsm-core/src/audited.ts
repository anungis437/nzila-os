import { randomUUID } from 'node:crypto'

import type {
  GuardResolver,
  MachineDefinition,
  TransitionContext,
  TransitionRecord,
  TransitionResult,
} from './types'
import { attemptTransition } from './engine'

/* ─── Audited transition runner ───────────────────────── */

/**
 * Execute a state transition with full audit trail.
 *
 * 1. Evaluates the transition via the pure engine
 * 2. Creates a TransitionRecord for audit persistence
 * 3. Returns the result + audit record for the caller to persist/emit
 *
 * This function does NOT write to DB or emit events directly —
 * the caller integrates with their own persistence layer.
 */
export function executeTransition<
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
  opts?: {
    entityId?: string
    reason?: string
    guardResolver?: GuardResolver<TState, TEntity, TRole>
  },
): {
  result: TransitionResult<TState>
  record: TransitionRecord<TState> | null
} {
  const start = performance.now()

  const result = attemptTransition(
    machine,
    currentState,
    targetState,
    ctx,
    resourceOrgId,
    entity,
    opts?.guardResolver,
  )

  const durationMs = Math.round(performance.now() - start)

  if (!result.ok) {
    return { result, record: null }
  }

  const record: TransitionRecord<TState> = {
    transitionId: randomUUID(),
    machineName: machine.name,
    machineVersion: machine.version,
    entityId: opts?.entityId ?? resourceOrgId,
    orgId: ctx.orgId,
    from: result.from,
    to: result.to,
    label: result.label,
    actorId: ctx.actorId,
    timestamp: new Date().toISOString(),
    reason: opts?.reason ?? '',
    durationMs,
  }

  return { result, record }
}
