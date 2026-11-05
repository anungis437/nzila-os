/**
 * POST /api/elections/[id]/succession
 *
 * A certified council election is superseded only when the authority kernel loads a
 * grant for the authenticated principal. The request body is not read. The election
 * is visible only when this organization owns it. The council vote route stays 501.
 */
import { withApi, ApiError, ErrorCode } from '@/lib/api/framework'
import { GOVERNANCE_SYSTEM_ROLES } from '@/lib/api-auth-guard'
import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'
import { loadCertifiedSupersessionGrant } from '@/lib/voting/election-succession-grant'
import { recordCertifiedSupersession } from '@/lib/voting/election-succession'

export const dynamic = 'force-dynamic'

export const POST = withApi(
  {
    auth: { required: true, roles: [...GOVERNANCE_SYSTEM_ROLES] },
    openapi: {
      tags: ['Governance'],
      summary: 'Supersede a certified council election',
      description: 'Loads an authority-kernel grant for the authenticated principal. A request body is not a grant.',
    },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required')

    const loaded = await withRLSContext({ organizationId, userId }, (tx) =>
      loadCertifiedSupersessionGrant(drizzleExecutor(tx), { electionId: params.id, organizationId, userId }),
    )
    if (!loaded.ok && loaded.code === 'STORE_UNAPPLIED') throw new ApiError(ErrorCode.NOT_IMPLEMENTED, loaded.message)
    if (!loaded.ok && loaded.code === 'NOT_FOUND') throw new ApiError(ErrorCode.NOT_FOUND, 'Election not found')
    if (!loaded.ok) throw ApiError.conflict(loaded.message)

    const result = await withSystemContext((tx) => recordCertifiedSupersession(drizzleExecutor(tx), params.id, loaded.grant, organizationId))
    if (!result.ok && result.code === 'STORE_UNAPPLIED') throw new ApiError(ErrorCode.NOT_IMPLEMENTED, result.message)
    if (!result.ok && result.code === 'NOT_FOUND') throw new ApiError(ErrorCode.NOT_FOUND, 'Election not found')
    if (!result.ok) throw ApiError.conflict(result.message)
    return { data: result }
  },
)
