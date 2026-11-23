/**
 * Case Next Actions API — GET /api/cases/[caseId]/next-actions
 *
 * Returns the set of allowed status transitions for the authenticated user.
 * Used by the UI to show/hide action buttons.
 *
 * PR-022: FSM Enforcement + Transition Tests
 */

import { NextResponse } from 'next/server'
import { toLifecycleState } from '@/lib/workflow/state-bridge'
import { allowedClaimCaseTransitions } from '@/lib/workflow/claim-transition-policy'
import { loadClaimTransitionSource } from '@/lib/cases/claim-transition-source'
import { decideCaseCapabilitiesBatch } from '@/lib/authority/store/route-adapter'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { logger } from '@/lib/logger'
import { getCaseActor, findReadableCase, caseAuthorizationResponse } from '@/lib/cases/case-authorization'
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard'
import { authorizationDenialResponse } from '@/lib/api/authorization-denial'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await params

    const actor = await getCaseActor()
    await requireEntitlement(actor.organizationId, 'grievance_case_suite')
    const result = await withRLSContext(async tx => {
      const claim = await findReadableCase(tx, actor, caseId)
      if (!claim) return null
      const projections = await decideCaseCapabilitiesBatch(tx, {
        userId: actor.userId, organizationId: actor.organizationId, caseIds: [claim.claimId],
      })
      const powers = projections.get(claim.claimId)
      const canTransition = powers?.['case:transition'].effect === 'allow'
      const canClose = powers?.['case:close'].effect === 'allow'
      if (!canTransition) return { claim, allowedTransitions: [] }
      const stored = await loadClaimTransitionSource(tx, actor.organizationId, claim.claimId)
      if (!stored) return null
      const allowedTransitions = allowedClaimCaseTransitions(stored, actor.role, { canTransition, canClose })
      return { claim: stored, allowedTransitions }
    })

    if (!result) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Case '${caseId}' not found.` },
        { status: 404 },
      )
    }

    // Map DB status to canonical LifecycleState, then get allowed transitions
    const lifecycleState = toLifecycleState('claim', result.claim.status)

    return NextResponse.json(
      {
        caseId: result.claim.claimId,
        currentStatus: result.claim.status,
        currentLifecycleState: lifecycleState,
        allowedTransitions: result.allowedTransitions,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch (error) {
    const denied = caseAuthorizationResponse(error) ?? authorizationDenialResponse(error)
    if (denied) return denied
    logger.error('Failed to get next actions', error as Error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 },
    )
  }
}
