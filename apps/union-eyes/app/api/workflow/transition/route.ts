/**
 * POST /api/workflow/transition
 *
 * Validates and executes a claim workflow transition.
 * Uses the FSM enforcement layer to prevent illegal state changes.
 *
 * Body: { claimNumber, targetStatus, notes? }
 * Returns: { success, claim?, error?, validation? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth-guard'
import { updateClaimStatus } from '@/lib/workflow-engine'
import {
  getAllowedClaimTransitions,
  type ClaimStatus,
} from '@/lib/services/claim-workflow-fsm'
import { db } from '@/db/db'
import { claims } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { withRLSContext } from '@/lib/db/with-rls-context'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { userId, organizationId } = await requireApiAuth({
      orgScoped: true,
      roles: ['steward', 'admin'],
    })

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const body = await request.json()
    const { claimNumber, targetStatus, notes } = body as {
      claimNumber?: string
      targetStatus?: string
      notes?: string
    }

    if (!claimNumber || !targetStatus) {
      return NextResponse.json(
        { success: false, error: 'claimNumber and targetStatus are required' },
        { status: 400 },
      )
    }

    // Fetch claim for pre-flight validation (org-scoped via RLS context)
    return await withRLSContext(async () => {
      const claimConditions = [eq(claims.claimNumber, claimNumber)];
      if (organizationId) {
        claimConditions.push(eq(claims.organizationId, organizationId));
      }

      const [claim] = await db
        .select()
        .from(claims)
        .where(and(...claimConditions))
        .limit(1)

      if (!claim) {
        return NextResponse.json(
          { success: false, error: 'Claim not found' },
          { status: 404 },
        )
      }

      const currentStatus = claim.status as ClaimStatus

      // Pre-flight FSM guard — show allowed transitions
      const allowed = getAllowedClaimTransitions(currentStatus, 'steward')
      if (!allowed.includes(targetStatus as ClaimStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: `Transition from '${currentStatus}' to '${targetStatus}' is not allowed`,
            allowed_transitions: allowed,
          },
          { status: 422 },
        )
      }

      // Execute transition (full FSM validation inside)
      const result = await updateClaimStatus(
        claimNumber,
        targetStatus as ClaimStatus,
        userId,
        notes,
      )

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 422 },
        )
      }

      return NextResponse.json({ success: true, claim: result.claim })
    })
  } catch (err) {
    logger.error('Workflow transition failed', { error: String(err) })
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 },
    )
  }
}
