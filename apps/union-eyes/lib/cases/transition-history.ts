import { and, desc, eq, or, type SQL } from 'drizzle-orm'
import { grievanceTransitions } from '@/db/schema/domains/claims/workflows'
import { ApiError } from '@/lib/api/errors'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { findReadableCase, type CaseActor, type CaseVisibility } from '@/lib/cases/case-authorization'

/**
 * Transition rows default to staff visibility, so an unmarked row is never an affirmative grant to a
 * member. Mirrors `caseHistoryVisibility` for the case-update timeline.
 */
export function transitionHistoryVisibility(visibility: CaseVisibility): SQL {
  if (visibility === 'internal') {
    return or(eq(grievanceTransitions.visibilityScope, 'member'), eq(grievanceTransitions.visibilityScope, 'staff'))!
  }
  return eq(grievanceTransitions.visibilityScope, 'member')
}

export interface TransitionHistoryEntry {
  id: string
  changedAt: string | null
  reason: string | null
  notes: string | null
}

/**
 * Case-scoped transition history. Unreadable and nonexistent cases are indistinguishable (404).
 * Stage names are deliberately not joined: the runtime role has no grant on grievance_stages.
 */
export async function readTransitionHistory(
  tx: RLSTx,
  actor: CaseActor,
  reference: string,
): Promise<TransitionHistoryEntry[]> {
  const claim = await findReadableCase(tx, actor, reference, false, 'case:read')
  if (!claim) throw ApiError.notFound('Case')

  const rows = await tx
    .select({
      id: grievanceTransitions.id,
      transitionedAt: grievanceTransitions.transitionedAt,
      reason: grievanceTransitions.reason,
      notes: grievanceTransitions.notes,
    })
    .from(grievanceTransitions)
    .where(and(
      eq(grievanceTransitions.claimId, claim.claimId),
      eq(grievanceTransitions.organizationId, actor.organizationId),
      transitionHistoryVisibility(claim.visibility),
    ))
    .orderBy(desc(grievanceTransitions.transitionedAt))

  return rows.map((row) => ({
    id: row.id,
    changedAt: row.transitionedAt?.toISOString() ?? null,
    reason: row.reason ?? null,
    notes: row.notes ?? null,
  }))
}
