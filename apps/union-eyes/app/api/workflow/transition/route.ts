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
import { claims } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { wrapSchemaQuery } from '@/lib/schema-error'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const transitionSchema = z.object({
  claimNumber: z.string().min(1).max(100),
  targetStatus: z.enum([
    'submitted',
    'under_review',
    'assigned',
    'investigation',
    'pending_documentation',
    'resolved',
    'rejected',
    'closed',
  ]),
  notes: z.string().max(5000).optional(),
})

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

    const rawBody = await request.json()
    const parsed = transitionSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.issues.map(i => ({ path: i.path, message: i.message })) },
        { status: 400 },
      )
    }

    const { claimNumber, targetStatus, notes } = parsed.data

    // Fetch claim for pre-flight validation (org-scoped via RLS context, row-locked)
    return await withRLSContext(async (tx) => {
      const claimConditions = [eq(claims.claimNumber, claimNumber)];
      if (organizationId) {
        claimConditions.push(eq(claims.organizationId, organizationId));
      }

      const [claim] = await wrapSchemaQuery(
        async () => await tx
          .select()
          .from(claims)
          .where(and(...claimConditions))
          .limit(1)
          .for('update'),
        { table: 'claims', route: '/api/workflow/transition', query: 'SELECT FOR UPDATE' }
      );

      if (!claim) {
        return NextResponse.json(
          { success: false, error: 'Claim not found' },
          { status: 404 },
        )
      }

      const currentStatus = claim.status as ClaimStatus

      // Pre-flight FSM guard — show allowed transitions
      const allowed = getAllowedClaimTransitions(currentStatus, 'steward')
      if (!allowed.includes(targetStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: `Transition from '${currentStatus}' to '${targetStatus}' is not allowed`,
            allowed_transitions: allowed,
          },
          { status: 422 },
        )
      }

      // Execute transition (full FSM validation inside, using same transaction)
      const result = await updateClaimStatus(
        claimNumber,
        targetStatus,
        userId,
        notes,
        tx,
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
