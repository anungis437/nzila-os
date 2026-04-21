/**
 * @nzila/executive-os — Action Queue State Machine
 *
 * Pure functions encoding the lifecycle of an executive agent action:
 *
 *   pending ─approve──▶ approved ─execute──▶ succeeded | failed
 *           └reject──▶ rejected
 *           └expire──▶ expired
 *
 *   auto-approval is permitted ONLY for insight-class actions.
 *
 * Persistence (writing to executive_agent_actions) is the host runner's
 * responsibility — these helpers only validate transitions.
 */
import type { ApprovalState, ExecutionStatus, ActionClass } from './contract.js'

export class ApprovalTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApprovalTransitionError'
  }
}

export interface ActionRecord {
  id: string
  actionClass: ActionClass
  approvalState: ApprovalState
  executionStatus: ExecutionStatus
  requiresApproval: boolean
}

export interface ApprovalDecision {
  approverId: string
  reason?: string
  at?: Date
}

export interface ExecutionOutcome {
  status: 'succeeded' | 'failed'
  result?: Record<string, unknown>
  error?: string
  at?: Date
}

// ── Transitions ────────────────────────────────────────────────────────────

export function approve(
  action: ActionRecord,
  decision: ApprovalDecision,
): ActionRecord & { approvedAt: Date; approverId: string } {
  if (action.approvalState !== 'pending') {
    throw new ApprovalTransitionError(
      `Cannot approve action ${action.id}: state is ${action.approvalState}, not pending`,
    )
  }
  if (!action.requiresApproval) {
    throw new ApprovalTransitionError(
      `Action ${action.id} does not require approval — should be marked auto`,
    )
  }
  return {
    ...action,
    approvalState: 'approved',
    approvedAt: decision.at ?? new Date(),
    approverId: decision.approverId,
  }
}

export function reject(
  action: ActionRecord,
  decision: ApprovalDecision,
): ActionRecord & { approvedAt: Date; approverId: string; rejectionReason: string | undefined } {
  if (action.approvalState !== 'pending') {
    throw new ApprovalTransitionError(
      `Cannot reject action ${action.id}: state is ${action.approvalState}, not pending`,
    )
  }
  return {
    ...action,
    approvalState: 'rejected',
    approvedAt: decision.at ?? new Date(),
    approverId: decision.approverId,
    rejectionReason: decision.reason,
  }
}

export function autoApprove(action: ActionRecord): ActionRecord {
  if (action.actionClass !== 'insight') {
    throw new ApprovalTransitionError(
      `Auto-approval is only allowed for insight-class actions (got ${action.actionClass})`,
    )
  }
  return { ...action, approvalState: 'auto', requiresApproval: false }
}

export function expire(action: ActionRecord): ActionRecord {
  if (action.approvalState !== 'pending') {
    throw new ApprovalTransitionError(
      `Cannot expire action ${action.id}: state is ${action.approvalState}, not pending`,
    )
  }
  return { ...action, approvalState: 'expired' }
}

export function markExecuted(
  action: ActionRecord,
  outcome: ExecutionOutcome,
): ActionRecord & { executedAt: Date; executionResult?: Record<string, unknown>; executionStatus: ExecutionStatus } {
  if (action.approvalState !== 'approved' && action.approvalState !== 'auto') {
    throw new ApprovalTransitionError(
      `Cannot execute action ${action.id}: approval state is ${action.approvalState}`,
    )
  }
  if (action.executionStatus !== 'not_executed' && action.executionStatus !== 'in_progress') {
    throw new ApprovalTransitionError(
      `Cannot execute action ${action.id}: already in execution status ${action.executionStatus}`,
    )
  }
  return {
    ...action,
    executionStatus: outcome.status,
    executionResult: outcome.result,
    executedAt: outcome.at ?? new Date(),
  }
}

// ── Predicates ─────────────────────────────────────────────────────────────

export function isExecutable(action: ActionRecord): boolean {
  return (
    (action.approvalState === 'approved' || action.approvalState === 'auto') &&
    action.executionStatus === 'not_executed'
  )
}

export function isAwaitingApproval(action: ActionRecord): boolean {
  return action.requiresApproval && action.approvalState === 'pending'
}
