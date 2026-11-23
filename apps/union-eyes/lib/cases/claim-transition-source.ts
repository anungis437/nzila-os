import { and, eq } from 'drizzle-orm'
import { claims } from '@/db/schema/claims-schema'
import type { RLSTx } from '@/lib/db/with-rls-context'

/** Call only after a live case decision. These additional facts are never part
 * of the general member/triage projection and are read in the caller's transaction. */
export async function loadClaimTransitionSource(
  tx: RLSTx,
  organizationId: string,
  claimId: string,
) {
  const [claim] = await tx
    .select({
      claimId: claims.claimId,
      claimNumber: claims.claimNumber,
      status: claims.status,
      description: claims.description,
      memberId: claims.memberId,
      assignedTo: claims.assignedTo,
      priority: claims.priority,
      createdAt: claims.createdAt,
      updatedAt: claims.updatedAt,
      statusChangedAt: claims.statusChangedAt,
    })
    .from(claims)
    .where(and(eq(claims.claimId, claimId), eq(claims.organizationId, organizationId)))
    .limit(1)
  return claim ?? null
}
