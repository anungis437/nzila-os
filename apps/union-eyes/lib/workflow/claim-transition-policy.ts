import {
  ROLE_LEVEL,
  validateTransition,
  type ActorRole,
  type TransitionResult,
} from './case-lifecycle'
import { toLifecycleState } from './state-bridge'
import { claimTransitionFacts, type ClaimTransitionFactSource } from './claim-transition-facts'
import { CLAIM_TRANSITION_TARGETS, type ClaimTransitionTarget } from './claim-transition-contract'
export { CLAIM_TRANSITION_TARGETS } from './claim-transition-contract'

/** This endpoint persists claim_status, not the formal grievance state machine.
 * Preserve its existing CUPE aliases without mapping document waiting through
 * the unrelated negotiation state or pretending an arbitration was persisted. */
export function claimTransitionTarget(value: string): ClaimTransitionTarget | null {
  const aliases: Record<string, ClaimTransitionTarget> = {
    filed: 'submitted',
    acknowledged: 'under_review',
    assigned: 'under_review',
    investigating: 'investigation',
    response_due: 'pending_documentation',
    settled: 'resolved',
    denied: 'rejected',
    withdrawn: 'closed',
  }
  if ((CLAIM_TRANSITION_TARGETS as readonly string[]).includes(value))
    return value as ClaimTransitionTarget
  return Object.hasOwn(aliases, value) ? aliases[value]! : null
}

export function claimResponseStatus(status: string): string {
  const labels: Record<string, string> = {
    submitted: 'filed',
    under_review: 'acknowledged',
    assigned: 'acknowledged',
    investigation: 'investigating',
    pending_documentation: 'response_due',
    resolved: 'settled',
    rejected: 'denied',
    closed: 'closed',
  }
  return labels[status] ?? status
}

export function caseLifecycleActorRole(actorRole: string): ActorRole | null {
  const aliases: Record<string, string> = {
    business_agent: 'chief_steward',
    union_admin: 'admin',
    union_staff: 'steward',
  }
  const role = Object.hasOwn(aliases, actorRole) ? aliases[actorRole]! : actorRole
  return Object.hasOwn(ROLE_LEVEL, role) ? (role as ActorRole) : null
}

export function validateClaimCaseTransition(
  claim: ClaimTransitionFactSource,
  actorRole: string,
  target: ClaimTransitionTarget,
  notes?: string,
): TransitionResult {
  const role = caseLifecycleActorRole(actorRole)
  if (!role) return { allowed: false, reason: 'Unknown case workflow role' }
  // claim_status has separate resolved/rejected outcomes even though both
  // rejection and archival map to the unified closed state. Preserve the
  // existing resolved -> closed rule instead of changing its outcome.
  if (claim.status === 'resolved' && target !== 'closed') {
    return { allowed: false, reason: 'A resolved claim may only be closed' }
  }
  const currentState = toLifecycleState('claim', claim.status)
  const targetState = toLifecycleState('claim', target)
  if (!currentState || !targetState)
    return { allowed: false, reason: 'Unknown claim lifecycle state' }
  return validateTransition({
    caseId: claim.claimId,
    currentState,
    targetState,
    actorRole: role as ActorRole,
    assignedTo: claim.assignedTo,
    priority: claim.priority as 'low' | 'medium' | 'high' | 'critical',
    ...claimTransitionFacts(claim, notes),
    notes,
  })
}

export function allowedClaimCaseTransitions(
  claim: ClaimTransitionFactSource,
  actorRole: string,
  powers: { canTransition: boolean; canClose: boolean },
  notes?: string,
) {
  if (!powers.canTransition) return []
  return CLAIM_TRANSITION_TARGETS.filter((target) => {
    if (
      (toLifecycleState('claim', target) === 'closed' ||
        toLifecycleState('claim', claim.status) === 'closed') &&
      !powers.canClose
    )
      return false
    return validateClaimCaseTransition(claim, actorRole, target, notes).allowed
  })
}
