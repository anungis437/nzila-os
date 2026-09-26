/**
 * PATCH /api/governance/lifecycle/conflicts/[conflictId]
 */
import { withApi, ApiError } from '@/lib/api/framework'
import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { policyConflicts } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ request, params, user }) => {
    const actorId = user?.id
    if (!actorId) {
      throw ApiError.badRequest('Authenticated user is required to resolve a policy conflict.')
    }

    const conflictId = (params as Record<string, string>).conflictId
    const body = await request.json() as { resolutionNotes: string }

    return withSystemContext(async () => {
      const [resolved] = await db
        .update(policyConflicts)
        .set({
          isActive: false,
          resolvedBy: actorId,
          resolvedAt: new Date(),
          resolutionNotes: body.resolutionNotes,
        })
        .where(eq(policyConflicts.id, conflictId))
        .returning()
      return { conflict: resolved }
    })
  },
)
