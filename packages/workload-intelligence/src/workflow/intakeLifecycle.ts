// ─── Intake Lifecycle State Machine ──────────────────────────────
// Encodes: new → under_review → converted/closed_no_case
// with rep authority gates on transitions.

import type { IntakeStatus, IntakeSubmission } from '../models/types.js'
import { IntakeStatuses } from '../models/types.js'
import type { AuthorityRole } from '../authority/permissions.js'
import { canConvertIntake } from '../authority/permissions.js'

export interface IntakeTransitionResult {
  readonly success: boolean
  readonly newStatus: IntakeStatus
  readonly reason?: string
}

/**
 * Valid transitions from each intake status.
 * Terminal states (converted, closed_no_case) have no outbound transitions.
 */
const VALID_TRANSITIONS: Record<IntakeStatus, readonly IntakeStatus[]> = {
  new: ['under_review', 'closed_no_case'],
  under_review: ['awaiting_member_info', 'converted', 'closed_no_case'],
  awaiting_member_info: ['under_review', 'closed_no_case'],
  converted: [],
  closed_no_case: [],
}

/**
 * Transitions that require rep/LRO authority (bargaining_committee+).
 */
const REP_GATED_TRANSITIONS: ReadonlySet<IntakeStatus> = new Set([
  'converted',
  'closed_no_case',
])

export function isTerminalIntakeStatus(status: IntakeStatus): boolean {
  return status === IntakeStatuses.CONVERTED || status === IntakeStatuses.CLOSED_NO_CASE
}

/**
 * Create an intake lifecycle manager for a specific submission.
 */
export function createIntakeWorkflow(intake: IntakeSubmission) {
  return {
    /**
     * Attempt a status transition with authority check.
     */
    transition(
      targetStatus: IntakeStatus,
      actorRole: AuthorityRole,
    ): IntakeTransitionResult {
      const currentStatus = intake.status

      // Terminal state — no further transitions
      if (isTerminalIntakeStatus(currentStatus)) {
        return {
          success: false,
          newStatus: currentStatus,
          reason: `Intake is in terminal status '${currentStatus}' — no further transitions allowed`,
        }
      }

      // Check if transition is valid
      const allowed = VALID_TRANSITIONS[currentStatus]
      if (!allowed?.includes(targetStatus)) {
        return {
          success: false,
          newStatus: currentStatus,
          reason: `Transition from '${currentStatus}' to '${targetStatus}' is not valid`,
        }
      }

      // Check authority for rep-gated transitions
      if (REP_GATED_TRANSITIONS.has(targetStatus) && !canConvertIntake(actorRole)) {
        return {
          success: false,
          newStatus: currentStatus,
          reason: `Only a rep/LRO (bargaining_committee+) can transition intake to '${targetStatus}'`,
        }
      }

      return {
        success: true,
        newStatus: targetStatus,
      }
    },

    /**
     * Get valid next statuses for the current state, considering the actor's role.
     */
    availableTransitions(actorRole: AuthorityRole): readonly IntakeStatus[] {
      const allowed = VALID_TRANSITIONS[intake.status] ?? []
      return allowed.filter((status) => {
        if (REP_GATED_TRANSITIONS.has(status)) {
          return canConvertIntake(actorRole)
        }
        return true
      })
    },
  }
}
