/**
 * GET  /api/governance/lifecycle/snapshots
 * POST /api/governance/lifecycle/snapshots
 */
import { withApi } from '@/lib/api/framework'
import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { policyGovernanceSnapshots, governedPolicies } from '@nzila/db/schema'
import { desc, sql } from 'drizzle-orm'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ request }) => {
    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100)
    const offset = Number(url.searchParams.get('offset') ?? 0)

    return withSystemContext(async () => {
      const snapshots = await db
        .select()
        .from(policyGovernanceSnapshots)
        .orderBy(desc(policyGovernanceSnapshots.generatedAt))
        .limit(limit)
        .offset(offset)

      return { snapshots, limit, offset }
    })
  },
)

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ request, user }) => {
    const body = await request.json() as { correlationId?: string }
    void body

    return withSystemContext(async () => {
      const active = await db
        .select({ id: governedPolicies.id, semver: governedPolicies.semver, domain: governedPolicies.domain })
        .from(governedPolicies)
        .where(sql`lifecycle_status IN ('active', 'published')`)

      const snapshotHash = createHash('sha256')
        .update(JSON.stringify(active))
        .digest('hex')

      const [snapshot] = await db
        .insert(policyGovernanceSnapshots)
        .values({
          snapshotHash,
          triggerType: 'manual',
          activePolicyGraph: active as never,
          generatedByUserId: user?.id ?? 'system',
        })
        .returning()

      return { snapshot }
    })
  },
)
