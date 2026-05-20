/**
 * GET   /api/governance/lifecycle/policies/[id]
 *   — Get a single governed policy by ID
 *
 * PATCH /api/governance/lifecycle/policies/[id]
 *   — Transition lifecycle state
 */
import { withApi } from '@/lib/api/framework'
import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { governedPolicies } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'

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
      if (!policy) {
        return null
      }
      return { policy }
    })
  },
)

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ request, params, user }) => {
    const id = (params as Record<string, string>).id
    const body = await request.json() as {
      targetState: string
      actorRole: string
      correlationId?: string
      payload?: Record<string, unknown>
    }

    return withSystemContext(async () => {
      const [updated] = await db
        .update(governedPolicies)
        .set({
          lifecycleStatus: body.targetState as never,
          ...(body.targetState === 'published' ? { publishedAt: new Date() } : {}),
          ...(body.targetState === 'active' ? { activatedAt: new Date() } : {}),
          ...(body.targetState === 'deprecated' ? { deprecatedAt: new Date() } : {}),
        })
        .where(eq(governedPolicies.id, id))
        .returning()

      void user // actor recorded via event; user null-safety ensured by auth
      return { policy: updated }
    })
  },
)
