/** Case history uses the same record scope and visibility as case notes. */
import { withApi } from '@/lib/api/with-api'
import { ApiError } from '@/lib/api/errors'
import { claimUpdates } from '@/db/schema/claims-schema'
import { and, eq, desc } from 'drizzle-orm'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { claimHistoryReference } from '@/lib/cases/claim-history-reference'
import { getCaseActor, findReadableCase, caseHistoryVisibility } from '@/lib/cases/case-authorization'
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Claims'], summary: 'Get case timeline',
      description: 'Returns visible timeline events for a specific case.',
    },
  },
  async ({ params }) => {
    const caseId = params?.caseId
    if (!caseId) throw ApiError.notFound('Case')
    const actor = await getCaseActor()
    await requireEntitlement(actor.organizationId, 'grievance_case_suite')
    return withRLSContext(async (tx) => {
      const claim = await findReadableCase(tx, actor, caseId)
      if (!claim) throw ApiError.notFound('Case')
      const updates = await tx.select().from(claimUpdates)
        .where(and(eq(claimUpdates.claimId, claimHistoryReference(claim.claimId)), caseHistoryVisibility(actor)))
        .orderBy(desc(claimUpdates.createdAt))
      return { data: updates.map(update => ({
        id: update.updateId,
        timestamp: update.createdAt?.toISOString() ?? null,
        type: update.updateType,
        description: update.message,
        actor: update.createdBy,
      })) }
    })
  },
)
