/**
 * GET /api/governance/lifecycle/policies/[id]/versions
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

      return { policyFamilyId: policy.policyFamilyId, versions }
    })
  },
)
