/**
 * GET /api/governance/lifecycle/snapshots/[at]
 */
import { withApi } from '@/lib/api/framework'
import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { policyGovernanceSnapshots } from '@nzila/db/schema'
import { lte, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ params }) => {
    const atParam = (params as Record<string, string>).at

    const at = new Date(atParam)
    if (isNaN(at.getTime())) {
      return { error: 'Invalid timestamp. Use ISO 8601 format.' }
    }

    return withSystemContext(async () => {
      const [snapshot] = await db
        .select()
        .from(policyGovernanceSnapshots)
        .where(lte(policyGovernanceSnapshots.generatedAt, at))
        .orderBy(desc(policyGovernanceSnapshots.generatedAt))
        .limit(1)

      return {
        snapshot: snapshot ?? null,
        resolvedVia: snapshot ? 'exact_or_before' : 'none',
        requestedAt: at.toISOString(),
      }
    })
  },
)
