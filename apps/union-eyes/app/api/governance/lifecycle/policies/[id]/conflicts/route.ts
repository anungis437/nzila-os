/**
 * GET  /api/governance/lifecycle/policies/[id]/conflicts
 *   — Get active conflicts for a policy
 *
 * POST /api/governance/lifecycle/policies/[id]/conflicts/resolve
 *   — Not here; see conflicts/[conflictId] PATCH
 */
import { withApi } from '@/lib/api/framework'
import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { policyConflicts } from '@nzila/db/schema'
import { eq, or, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ params, request }) => {
    const id = (params as Record<string, string>).id
    const url = new URL(request.url)
    const activeOnly = url.searchParams.get('activeOnly') !== 'false'

    return withSystemContext(async () => {
      const conditions = [
        or(
          eq(policyConflicts.policyIdA, id),
          eq(policyConflicts.policyIdB, id),
        ),
      ]
      if (activeOnly) conditions.push(eq(policyConflicts.isActive, true))

      const conflicts = await db
        .select()
        .from(policyConflicts)
        .where(and(...conditions))
        .orderBy(policyConflicts.severity, policyConflicts.detectedAt)

      return { conflicts }
    })
  },
)
