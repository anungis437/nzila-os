/**
 * GET  /api/governance/lifecycle/policies
 *   — List governed policies with optional filters
 *
 * POST /api/governance/lifecycle/policies
 *   — Create a new policy draft
 */
import { withApi } from '@/lib/api/framework'
import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { governedPolicies, type NewGovernedPolicyRow } from '@nzila/db/schema'
import { desc, eq, and, type SQL } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ request }) => {
    const url = new URL(request.url)
    const domain = url.searchParams.get('domain')
    const status = url.searchParams.get('status')
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)
    const offset = Number(url.searchParams.get('offset') ?? 0)

    return withSystemContext(async () => {
      const conditions: SQL<unknown>[] = []
      if (domain) conditions.push(eq(governedPolicies.domain, domain))
      if (status) conditions.push(eq(governedPolicies.lifecycleStatus, status as never))

      const rows = await db
        .select()
        .from(governedPolicies)
        .where(conditions.length > 1 ? and(...conditions) : conditions[0])
        .orderBy(desc(governedPolicies.createdAt))
        .limit(limit)
        .offset(offset)

      return { policies: rows, limit, offset }
    })
  },
)

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ request, user }) => {
    const body = await request.json() as {
      policyFamilyId: string
      semver: string
      name: string
      domain: string
      workflowBindings?: unknown
      operationalScope?: unknown
      authorRole: string
      governanceRationale: string
      riskClassification?: string
      reviewCadenceDays?: number
      effectiveFrom?: string
      effectiveUntil?: string
    }

    return withSystemContext(async () => {
      const values: NewGovernedPolicyRow = {
        policyFamilyId: body.policyFamilyId,
        semver: body.semver,
        name: body.name,
        domain: body.domain,
        workflowBindings: (body.workflowBindings as string[] | undefined) ?? [],
        operationalScope: (body.operationalScope ?? {}) as Record<string, unknown>,
        authorId: user?.id ?? 'system',
        authorRole: body.authorRole,
        governanceRationale: body.governanceRationale,
        riskClassification: (body.riskClassification ?? 'medium') as 'low' | 'medium' | 'high' | 'critical',
        reviewCadenceDays: body.reviewCadenceDays ?? 365,
        lifecycleStatus: 'draft',
        replayCompatibilityVersion: '1',
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : null,
        effectiveUntil: body.effectiveUntil ? new Date(body.effectiveUntil) : null,
      }
      const [draft] = await db.insert(governedPolicies).values(values).returning()
      return { policy: draft }
    })
  },
)
