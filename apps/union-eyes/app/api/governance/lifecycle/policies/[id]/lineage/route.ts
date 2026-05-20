/**
 * GET /api/governance/lifecycle/policies/[id]/lineage
 */
import { withApi } from '@/lib/api/framework'
import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { governedPolicies } from '@nzila/db/schema'
import { eq, asc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ params }) => {
    const id = (params as Record<string, string>).id

    return withSystemContext(async () => {
      const [policy] = await db
        .select()
        .from(governedPolicies)
        .where(eq(governedPolicies.id, id))
        .limit(1)
      if (!policy) return null

      const versions = await db
        .select()
        .from(governedPolicies)
        .where(eq(governedPolicies.policyFamilyId, policy.policyFamilyId))
        .orderBy(asc(governedPolicies.createdAt))

      const nodes = versions.map((v) => ({
        id: v.id,
        type: 'policyNode',
        data: {
          id: v.id,
          semver: v.semver,
          name: v.name,
          lifecycleStatus: v.lifecycleStatus,
          riskClassification: v.riskClassification,
          domain: v.domain,
          publishedAt: v.publishedAt,
          activatedAt: v.activatedAt,
          isHead: v.supersededBy === null,
          isCurrent: v.id === id,
        },
        position: { x: 0, y: 0 },
      }))

      const edges = versions
        .filter((v) => v.supersededBy !== null)
        .map((v) => ({
          id: `${v.id}->${v.supersededBy}`,
          source: v.id,
          target: v.supersededBy as string,
          label: 'superseded by',
          type: 'smoothstep',
          animated: false,
        }))

      return { policyFamilyId: policy.policyFamilyId, nodes, edges }
    })
  },
)
