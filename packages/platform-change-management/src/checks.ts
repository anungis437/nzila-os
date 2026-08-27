/**
 * @nzila/platform-change-management — Deployment validation checks
 *
 * Pre-deployment validation that enforces:
 *   - Change record exists for environment + service
 *   - Approval status is APPROVED
 *   - Required approvals are satisfied
 *   - Current time is inside approved window (unless EMERGENCY)
 *   - Commit/PR reference matches deployment context
 *
 * @module @nzila/platform-change-management/checks
 */
import { findApprovedChange, loadAllChanges } from './service'
import { evaluateChangeRequirements } from './approvals'
import { isWithinApprovedWindow, isInFreezePeriod, loadCalendarPolicy } from './calendar'
import type { ChangeValidationResult, Environment } from './types'

export interface ValidateChangeInput {
  env: Environment
  service: string
  commitSha?: string
  prRef?: string
  now?: Date
  baseDir?: string
}

/**
 * Validate that a deployment is allowed based on change management policy.
 *
 * This is the primary gate used by CI/CD pipelines before deploying.
 */
export function validateChangeWindow(input: ValidateChangeInput): ChangeValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const now = input.now ?? new Date()

  // 1. Find an approved change record for this env + service
  const change = findApprovedChange(input.env, input.service, { baseDir: input.baseDir, now })

  if (!change) {
    errors.push(
      `No approved change record found for service="${input.service}" environment="${input.env}". ` +
      `Create and approve a change record before deploying.`,
    )
    return { valid: false, errors, warnings }
  }

  // 2. Environment match (already filtered, but double-check)
  if (change.environment !== input.env) {
    errors.push(`Change ${change.change_id} targets ${change.environment}, not ${input.env}.`)
  }

  // 3. Service match
  if (change.service !== input.service) {
    errors.push(`Change ${change.change_id} targets service "${change.service}", not "${input.service}".`)
  }

  // 4. Approval status
  if (change.approval_status !== 'APPROVED') {
    errors.push(`Change ${change.change_id} approval_status is "${change.approval_status}", expected "APPROVED".`)
  }

  // 5. Required approvals
  const requirements = evaluateChangeRequirements(change)
  if (!requirements.approvalSatisfied) {
    errors.push(
      `Change ${change.change_id} is missing required approvals: ${requirements.missingApprovals.join(', ')}.`,
    )
  }

  // 6. Window validation (EMERGENCY changes may bypass window restriction)
  if (change.change_type === 'EMERGENCY') {
    if (!isWithinApprovedWindow(change, now)) {
      warnings.push(
        `EMERGENCY change ${change.change_id} is outside its implementation window. ` +
        `A Post Implementation Review will be required.`,
      )
    }
  } else {
    if (!isWithinApprovedWindow(change, now)) {
      errors.push(
        `Current time is outside the approved implementation window for ${change.change_id}. ` +
        `Window: ${change.implementation_window_start} to ${change.implementation_window_end}.`,
      )
    }
  }

  // 7. Freeze period check
  const policy = loadCalendarPolicy(input.baseDir)
  const freeze = isInFreezePeriod(input.env, {
    start: change.implementation_window_start,
    end: change.implementation_window_end,
  }, policy)

  if (freeze && change.change_type !== 'EMERGENCY') {
    errors.push(
      `Change ${change.change_id} overlaps with freeze period "${freeze.name}" ` +
      `(${freeze.start} to ${freeze.end}). Only EMERGENCY changes are allowed.`,
    )
  } else if (freeze && change.change_type === 'EMERGENCY') {
    warnings.push(
      `EMERGENCY change ${change.change_id} overrides freeze period "${freeze.name}".`,
    )
  }

  // 8. Commit/PR reference match (optional but warned if missing)
  if (input.commitSha) {
    if (
      change.linked_commits.length > 0 &&
      !change.linked_commits.includes(input.commitSha)
    ) {
      warnings.push(
        `Deployment commit ${input.commitSha} is not listed in change ${change.change_id} linked_commits.`,
      )
    }
  }

  if (input.prRef) {
    if (
      change.linked_prs.length > 0 &&
      !change.linked_prs.includes(input.prRef)
    ) {
      warnings.push(
        `PR ${input.prRef} is not listed in change ${change.change_id} linked_prs.`,
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    change_id: change.change_id,
  }
}

/**
 * List all changes that are pending PIR (Post Implementation Review).
 * These are NORMAL/EMERGENCY changes in COMPLETED/FAILED/ROLLED_BACK status
 * without a post_implementation_review.
 */
export function listChangesPendingPIR(opts?: { baseDir?: string }): import('./types').ChangeRecord[] {
  return loadAllChanges(opts).filter(
    (c) =>
      (c.change_type === 'NORMAL' || c.change_type === 'EMERGENCY') &&
      (c.status === 'COMPLETED' || c.status === 'FAILED' || c.status === 'ROLLED_BACK') &&
      !c.post_implementation_review,
  )
}
