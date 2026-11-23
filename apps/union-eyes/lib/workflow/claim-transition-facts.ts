import { detectAllSignals, type CaseForSignals } from '@/lib/services/lro-signals'
import { slaClockStart } from './sla-clock'
import { toLegacyCaseState, toLifecycleState } from './state-bridge'
import type { LifecycleState } from './case-lifecycle'

/** Server-held facts shared by both claim transition entrypoints. A last edit
 * must not restart the status clock, and omitted facts must not disable guards. */
export interface ClaimTransitionFactSource {
  claimId: string
  claimNumber?: string | null
  status: string
  description?: string | null
  memberId?: string | null
  assignedTo?: string | null
  priority: string
  createdAt?: Date | null
  updatedAt?: Date | null
  statusChangedAt?: Date | null
}

export function claimTransitionFacts(
  claim: ClaimTransitionFactSource,
  notes?: string,
  now = new Date(),
) {
  return storedCaseTransitionFacts(
    claim,
    toLifecycleState('claim', claim.status) ?? 'submitted',
    notes,
    now,
  )
}

export function storedCaseTransitionFacts(
  claim: ClaimTransitionFactSource,
  state: LifecycleState,
  notes?: string,
  now = new Date(),
) {
  const createdAt = claim.createdAt ?? now
  const signalCase: CaseForSignals = {
    id: claim.claimId,
    title: claim.description?.slice(0, 120) ?? claim.claimNumber ?? claim.claimId,
    memberId: claim.memberId ?? '',
    memberName: claim.memberId ?? '',
    currentState: toLegacyCaseState(state),
    priority: claim.priority as CaseForSignals['priority'],
    createdAt,
    lastUpdated: claim.updatedAt ?? createdAt,
    timeline: [{ type: 'submitted', timestamp: createdAt }],
    assignedOfficerId: claim.assignedTo || undefined,
  }
  return {
    statusChangedAt: slaClockStart(claim, now).startedAt,
    hasRequiredDocumentation: Boolean(
      (claim.description && claim.description.length > 20) || (notes && notes.length > 20),
    ),
    hasUnresolvedCriticalSignals: detectAllSignals([signalCase], now).some(
      (signal) => signal.severity === 'critical' && signal.actionable,
    ),
  }
}
