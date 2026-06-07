/**
 * GET /api/governance/lifecycle/policy-events
 */
import { withApi } from '@/lib/api/framework'
import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { policyGovernanceEvents } from '@nzila/db/schema'
import { eq, and, gte, lte, desc, type SQL } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ request }) => {
    const url = new URL(request.url)
    const policyId = url.searchParams.get('policyId')
    const domain = url.searchParams.get('domain')
    const eventType = url.searchParams.get('eventType')
    const fromDate = url.searchParams.get('fromDate')
    const toDate = url.searchParams.get('toDate')
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)
    const offset = Number(url.searchParams.get('offset') ?? 0)

    return withSystemContext(async () => {
      const conditions: SQL<any>[] = []
      if (policyId) conditions.push(eq(policyGovernanceEvents.policyId, policyId))
      if (domain) conditions.push(eq(policyGovernanceEvents.domain, domain))
      if (eventType) conditions.push(eq(policyGovernanceEvents.eventType, eventType as never))
      if (fromDate) conditions.push(gte(policyGovernanceEvents.createdAt, new Date(fromDate)))
      if (toDate) conditions.push(lte(policyGovernanceEvents.createdAt, new Date(toDate)))

      const events = await db
        .select()
        .from(policyGovernanceEvents)
        .where(conditions.length > 1 ? and(...conditions) : conditions[0])
        .orderBy(desc(policyGovernanceEvents.createdAt))
        .limit(limit)
        .offset(offset)

      return { events, limit, offset }
    })
  },
)
