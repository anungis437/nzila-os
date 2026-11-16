import type { RLSTx } from '@/lib/db/with-rls-context'
import { AuthorityStoreError } from '@/lib/authority/store/executor'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'
import { assignPrimaryRepresentative, listCaseCollaborators } from '@/lib/services/case-access-service'
import type { CaseActor } from './case-authorization'
import { matchingRepresentativeEligible } from './assignment-eligibility'
import { lockAssignmentScope, representativeWorkloads } from './assignment-capacity'

export class AssignmentMatchingError extends Error {
  readonly code = 'NO_ELIGIBLE_MATCH'
}

import { matchingExpertise, rankMatchingProfiles } from './assignment-ranking'
export { matchingExpertise, rankMatchingProfiles } from './assignment-ranking'

/** Called only after the route has locked and authorized this case for case:assign. The kernel still decides every attempted grant. */
export async function automaticallyAssignRepresentative(tx: RLSTx, actor: Pick<CaseActor, 'userId' | 'organizationId'>, caseId: string, caseType: string | null) {
  await lockAssignmentScope(tx, actor.organizationId)
  const states = (await drizzleExecutor(tx).query<{ status: string }>(`SELECT status::text FROM public.grievances WHERE organization_id=$1::uuid AND id=$2::uuid
    UNION ALL SELECT status::text FROM public.claims WHERE organization_id=$1::uuid AND claim_id=$2::uuid`, [actor.organizationId, caseId])).rows
  if (states.length !== 1 || ['resolved','rejected','closed','settled','withdrawn','denied','converted','closed_no_case'].includes(states[0]!.status))
    throw new AssignmentMatchingError('An open case is required for automatic assignment.')
  const current = await listCaseCollaborators(tx, actor.organizationId, caseId)
  if (current.some(relation => relation.relation === 'owner' || relation.relation === 'assignee'))
    throw new AssignmentMatchingError('This case already has a representative. Use the reassignment workflow.')
  const profiles = (await drizzleExecutor(tx).query<{ id: string; user_id: string; specialization: string | null; max_caseload: number }>(
    'SELECT id::text,user_id::text,specialization,max_caseload FROM public.stewards WHERE org_id=$1::uuid AND active ORDER BY id FOR UPDATE',
    [actor.organizationId],
  )).rows
  const workloads = await representativeWorkloads(tx, actor.organizationId, profiles.map(profile => profile.user_id))
  const ranked = rankMatchingProfiles(profiles.map(profile => ({
    id: profile.id, userId: profile.user_id, specialization: profile.specialization,
    maxCaseload: profile.max_caseload, openCases: workloads.get(profile.user_id) ?? 0,
  })), caseType)
  for (const profile of ranked) {
    if (!(await matchingRepresentativeEligible(tx, actor, profile.userId))) continue
    try {
      // A refused candidate leaves no partial revocation, grant or audit. Infrastructure/audit faults abort the operation.
      const kernel = await tx.transaction(nested => assignPrimaryRepresentative(nested, {
        organizationId: actor.organizationId, grievanceId: caseId, issuerUserId: actor.userId, assigneeUserId: profile.userId,
      }))
      return { assigneeId: profile.userId, stewardProfileId: profile.id, kernel, matching: {
        strategy: 'recorded_expertise_live_workload_v1', specialization: profile.specialization,
        exactExpertise: !!caseType && matchingExpertise(profile.specialization, caseType),
        openCasesBefore: profile.openCases, maxCaseload: profile.maxCaseload,
      } }
    } catch (error) {
      if (!(error instanceof AuthorityStoreError) || !['DENIED', 'PRECONDITION'].includes(error.code)) throw error
    }
  }
  throw new AssignmentMatchingError('No authorized representative has matching recorded expertise and available capacity.')
}
