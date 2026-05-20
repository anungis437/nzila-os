/**
 * PATCH /api/governance/lifecycle/conflicts/[conflictId]
 */
import { withApi } from '@/lib/api/framework'
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
    const conflictId = (params as Record<string, string>).conflictId
    const body = await request.json() as { resolutionNotes: string }

    return withSystemContext(async () => {
      const [resolved] = await db
        .update(policyConflicts)
        .set({
          isActive: false,
          resolvedBy: user?.id ?? 'system',
          resolvedAt: new Date(),
          resolutionNotes: body.resolutionNotes,
        })
        .where(eq(policyConflicts.id, conflictId))
        .returning()
      return { conflict: resolved }
    })
  },
)
