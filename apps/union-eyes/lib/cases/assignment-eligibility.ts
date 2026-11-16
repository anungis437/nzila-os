import type { RLSTx } from '@/lib/db/with-rls-context'
import { activeMembershipSource } from '@/lib/authority/store/active-membership-source'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'
import { caseAssigneeEligible } from './case-authorization'

/** Matching profiles describe eligible representatives; organization administration alone is not a representation capacity. */
export async function matchingRepresentativeEligible(tx: RLSTx, actor: { userId: string; organizationId: string }, userId: string) {
  if (!(await caseAssigneeEligible(tx, actor, userId))) return false
  const rows = await activeMembershipSource(drizzleExecutor(tx), actor.organizationId, [userId])
  return rows.length === 1 && rows[0]!.userId === userId && rows[0]!.status === 'active' &&
    rows[0]!.capacities.some(capacity => ['steward','chief_steward','officer'].includes(capacity))
}
