/**
 * GET  /api/governance/lifecycle/policies/[id]/replay
 * POST /api/governance/lifecycle/policies/[id]/replay
 */
import { withApi } from '@/lib/api/framework'
import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { policyReplaySessions, governedPolicies } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ params, request }) => {
    const id = (params as Record<string, string>).id
    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100)

    return withSystemContext(async () => {
      const sessions = await db
        .select()
        .from(policyReplaySessions)
        .where(eq(policyReplaySessions.sourcePolicyId, id))
        .orderBy(desc(policyReplaySessions.createdAt))
        .limit(limit)

      return { sessions }
    })
  },
)

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ request, params, user }) => {
    const id = (params as Record<string, string>).id
    const body = await request.json() as {
      replayType?: 'historical' | 'candidate' | 'drift_check'
      targetPolicyId?: string | null
      actorRole: string
      fromDate?: string
      toDate?: string
      domainFilter?: string
    }

    return withSystemContext(async () => {
      const [source] = await db
        .select()
        .from(governedPolicies)
        .where(eq(governedPolicies.id, id))
        .limit(1)
      if (!source) return null

      const [session] = await db
        .insert(policyReplaySessions)
        .values({
          sourcePolicyId: id,
          sourcePolicyVersion: source.semver,
          targetPolicyId: body.targetPolicyId ?? null,
          replayType: body.replayType ?? 'historical',
          initiatorUserId: user?.id ?? 'system',
          initiatorRole: body.actorRole,
          fromDate: body.fromDate ? new Date(body.fromDate) : null,
          toDate: body.toDate ? new Date(body.toDate) : null,
          domainFilter: body.domainFilter ?? null,
          status: 'pending',
          decisionCountReplayed: 0,
          changedOutcomeCount: 0,
          driftDetected: false,
        })
        .returning()
      return { session }
    })
  },
)
