/**
 * Flow — Workflow Error Hierarchy
 *
 * Typed errors for every invalid mutation path. Each error carries
 * structured context for logging, metrics, and API responses.
 */

/** Base class for all Flow workflow errors. */
export abstract class FlowWorkflowError extends Error {
  abstract readonly code: string
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

/** Thrown when a state transition is not allowed by the state machine. */
export class InvalidWorkflowTransitionError extends FlowWorkflowError {
  readonly code = 'INVALID_TRANSITION'
  constructor(
    public readonly workflow: string,
    public readonly from: string,
    public readonly to: string,
    public readonly allowed: readonly string[] = [],
  ) {
    super(
      `[${workflow}] Transition ${from} → ${to} is not allowed.` +
      (allowed.length > 0 ? ` Allowed targets: ${allowed.join(', ')}` : ''),
    )
  }
}

/** Thrown when a prerequisite for a workflow step is not met. */
export class MissingWorkflowPrerequisiteError extends FlowWorkflowError {
  readonly code = 'MISSING_PREREQUISITE'
  constructor(
    public readonly workflow: string,
    public readonly step: string,
    public readonly missing: readonly string[],
  ) {
    super(
      `[${workflow}] Cannot execute "${step}": missing prerequisites — ${missing.join('; ')}`,
    )
  }
}

/** Thrown when a payment gate blocks an operation. */
export class PaymentGateBlockedError extends FlowWorkflowError {
  readonly code = 'PAYMENT_GATE_BLOCKED'
  constructor(
    public readonly orderId: string,
    public readonly gate: 'po_creation' | 'production_start' | 'shipment',
    public readonly blockers: readonly string[],
    public readonly outstandingBalance: number,
  ) {
    super(
      `Payment gate blocked for order ${orderId} at ${gate}: ${blockers.join('; ')}`,
    )
  }
}

/** Thrown when a domain invariant is violated (e.g. closed order re-entered). */
export class WorkflowInvariantError extends FlowWorkflowError {
  readonly code = 'INVARIANT_VIOLATION'
  constructor(
    public readonly workflow: string,
    public readonly invariant: string,
    public readonly context: Record<string, unknown> = {},
  ) {
    super(`[${workflow}] Invariant violated: ${invariant}`)
  }
}

/** Thrown when an entity required for an operation cannot be found. */
export class EntityNotFoundError extends FlowWorkflowError {
  readonly code = 'ENTITY_NOT_FOUND'
  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
  ) {
    super(`${entityType} "${entityId}" not found`)
  }
}
