/**
 * GET /api/governance/lifecycle/conflicts
 *   — Platform-wide active conflict list
 *
 * PATCH /api/governance/lifecycle/conflicts/[conflictId]
 *   — Resolve a conflict (handled in separate file — see [conflictId]/route.ts)
 */
import { withApi } from '@/lib/api/framework'
import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { policyConflicts } from '@nzila/db/schema'
import { eq, desc, and, type SQL } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ request }) => {
    const url = new URL(request.url)
    const activeOnly = url.searchParams.get('activeOnly') !== 'false'
    const severity = url.searchParams.get('severity')
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)

    return withSystemContext(async () => {
      const conditions: SQL<any>[] = []
      if (activeOnly) conditions.push(eq(policyConflicts.isActive, true))
      if (severity) conditions.push(eq(policyConflicts.severity, severity as never))

      const conflicts = await db
        .select()
        .from(policyConflicts)
        .where(conditions.length > 1 ? and(...conditions) : conditions[0])
        .orderBy(desc(policyConflicts.detectedAt))
        .limit(limit)

      return { conflicts, count: conflicts.length }
    })
  },
)
