/**
 * Zonga — Workflow Engine Types
 *
 * Shared types for all Zonga Flow-orchestrated state machines.
 * Follows the established Flow app workflow pattern.
 */

export class InvalidTransitionError extends Error {
  constructor(
    public readonly workflow: string,
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`[${workflow}] Invalid transition: ${from} → ${to}`)
    this.name = 'InvalidTransitionError'
  }
}

export interface Transition<S extends string> {
  readonly from: S
  readonly to: S
  readonly label: string
  readonly auditEvent: string | null
}

export interface TransitionResult<S extends string> {
  readonly ok: boolean
  readonly from: S
  readonly to: S
  readonly label: string
  readonly auditEvent: string | null
  readonly reason?: string
}

/**
 * Validate a state transition against a set of allowed transitions.
 */
export function validateTransition<S extends string>(
  workflow: string,
  transitions: readonly Transition<S>[],
  from: S,
  to: S,
): TransitionResult<S> {
  const match = transitions.find((t) => t.from === from && t.to === to)
  if (!match) {
    return {
      ok: false,
      from,
      to,
      label: '',
      auditEvent: null,
      reason: `No valid transition from "${from}" to "${to}" in ${workflow}`,
    }
  }
  return { ok: true, from, to, label: match.label, auditEvent: match.auditEvent }
}

/**
 * Attempt a state transition — throws on invalid transition.
 */
export function attemptTransition<S extends string>(
  workflow: string,
  transitions: readonly Transition<S>[],
  from: S,
  to: S,
): TransitionResult<S> {
  const result = validateTransition(workflow, transitions, from, to)
  if (!result.ok) {
    throw new InvalidTransitionError(workflow, from, to)
  }
  return result
}

/**
 * Get all available transitions from a given state.
 */
export function getAvailableTransitions<S extends string>(
  transitions: readonly Transition<S>[],
  from: S,
): readonly Transition<S>[] {
  return transitions.filter((t) => t.from === from)
}
