/**
 * Case Next Actions API — GET /api/cases/[caseId]/next-actions
 *
 * Returns the set of allowed status transitions for the authenticated user.
 * Used by the UI to show/hide action buttons.
 *
 * PR-022: FSM Enforcement + Transition Tests
 */

import { NextResponse } from 'next/server'
import { getAllowedTransitions, type ActorRole } from '@/lib/workflow/case-lifecycle'
import { toLifecycleState, toLegacyClaimStatus } from '@/lib/workflow/state-bridge'
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
    const claim = await withRLSContext(tx => findReadableCase(tx, actor, caseId))

    if (!claim) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Case '${caseId}' not found.` },
        { status: 404 },
      )
    }

    // Map DB status to canonical LifecycleState, then get allowed transitions
    const lifecycleState = toLifecycleState('claim', claim.status) ?? 'submitted'

    // Resolve actor role from org membership
    const actorRole = normalizeActorRole(actor.role)

    const allowedLifecycle = getAllowedTransitions(lifecycleState, actorRole)
    // Convert back to legacy ClaimStatus values for backward-compat consumers
    const allowedTransitions = [...new Set(allowedLifecycle.map(toLegacyClaimStatus))]

    return NextResponse.json(
      {
        caseId,
        currentStatus: claim.status,
        currentLifecycleState: lifecycleState,
        allowedTransitions,
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

function normalizeActorRole(role: string | null | undefined): ActorRole {
  const map: Record<string, ActorRole> = {
    platform_admin: 'system_admin',
    system_admin: 'system_admin',
    admin: 'admin',
    union_admin: 'admin',
    officer: 'officer',
    chief_steward: 'chief_steward',
    business_agent: 'chief_steward',
    steward: 'steward',
    union_staff: 'steward',
    member: 'member',
  }
  return map[role ?? ''] ?? 'member'
}
