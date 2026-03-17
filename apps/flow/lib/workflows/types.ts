/**
 * Flow — Workflow Engine Types
 *
 * Shared types for all Flow state machines.
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
  from: S
  to: S
  label: string
  auditEvent: string | null
}

export interface TransitionResult<S extends string> {
  ok: boolean
  from: S
  to: S
  label: string
  auditEvent: string | null
  reason?: string
}
