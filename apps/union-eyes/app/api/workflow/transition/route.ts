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
import { getAllowedTransitions, type ActorRole } from '@/lib/workflow/case-lifecycle'
import { toLifecycleState, toLegacyClaimStatus } from '@/lib/workflow/state-bridge'

// Local alias for DB claim status values — decoupled from deprecated FSM module
type ClaimStatus =
  | 'submitted' | 'under_review' | 'assigned' | 'investigation'
  | 'pending_documentation' | 'resolved' | 'rejected' | 'closed'
import { claims, claimUpdates } from '@/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { wrapSchemaQuery } from '@/lib/schema-error'
import { eventBus, AppEvents } from '@/lib/events'
import '@/lib/events/pilot-event-listeners'
import {
  recordUnionEyesCaseAcknowledged,
  recordUnionEyesCaseResolved,
  recordUnionEyesWorkflowTransition,
  recordUnionEyesWorkflowTransitionFailure,
} from '@/lib/pilot-metrics'
import { transitionSchema } from './schemas'


export const dynamic = 'force-dynamic'

function statusForAuthError(message: string): number {
  if (message.startsWith('Unauthorized')) {
    return 401
  }

  if (message.startsWith('Forbidden')) {
    return 403
  }

  return 500
}

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
    const traceId = request.headers.get('x-trace-id') ?? crypto.randomUUID()

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

      // Pre-flight FSM guard via canonical lifecycle bridge
      const currentLifecycle = toLifecycleState('claim', currentStatus) ?? 'submitted'
      const allowedLifecycle = getAllowedTransitions(currentLifecycle, 'steward')
      const allowed = [...new Set(allowedLifecycle.map(toLegacyClaimStatus))]
      if (!allowed.includes(targetStatus as ClaimStatus)) {
        recordUnionEyesWorkflowTransitionFailure(
          organizationId || claim.organizationId,
          claim.claimId,
          `blocked:${currentStatus}->${targetStatus}`,
          userId,
          traceId,
        ).catch((metricErr) => logger.warn('Pilot metric emit failed', {
          error: String(metricErr),
          metric: 'workflow_failures',
        }))

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

      // Emit CLAIM_UPDATED for pilot observability
      const [{ value: priorUpdates }] = await tx
        .select({ value: count() })
        .from(claimUpdates)
        .where(eq(claimUpdates.claimId, claim.claimId));

      eventBus.emit(AppEvents.CLAIM_UPDATED, {
        claimId: claim.claimId,
        organizationId: organizationId || claim.organizationId,
        updatedBy: userId,
        newStatus: targetStatus,
        isFirstUpdate: priorUpdates <= 1, // 1 = the update we just created
      }, { organizationId: organizationId || claim.organizationId, userId });

      recordUnionEyesWorkflowTransition(
        organizationId || claim.organizationId,
        claim.claimId,
        true,
        targetStatus,
        userId,
        traceId,
      ).catch((metricErr) => logger.warn('Pilot metric emit failed', {
        error: String(metricErr),
        metric: 'workflow_transition_success_rate',
      }))

      if (currentStatus === 'submitted' && targetStatus !== 'submitted') {
        const createdAt = claim.createdAt ?? claim.updatedAt ?? new Date()
        const firstResponseMinutes = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 60_000)
        recordUnionEyesCaseAcknowledged(
          organizationId || claim.organizationId,
          claim.claimId,
          firstResponseMinutes,
          userId,
          traceId,
        ).catch((metricErr) => logger.warn('Pilot metric emit failed', {
          error: String(metricErr),
          metric: 'avg_time_to_first_response',
        }))
      }

      if (targetStatus === 'resolved' || targetStatus === 'closed') {
        const createdAt = claim.createdAt ?? claim.updatedAt ?? new Date()
        const resolutionHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3_600_000)
        recordUnionEyesCaseResolved(
          organizationId || claim.organizationId,
          claim.claimId,
          resolutionHours,
          userId,
          traceId,
        ).catch((metricErr) => logger.warn('Pilot metric emit failed', {
          error: String(metricErr),
          metric: 'avg_time_to_resolution',
        }))
      }

      return NextResponse.json({ success: true, claim: result.claim })
    })
  } catch (err) {
    logger.error('Workflow transition failed', { error: String(err) })
    const message = err instanceof Error ? err.message : 'Internal error'
    const exposeDetails = process.env.QA_TEST_ENV === 'true' || process.env.NODE_ENV !== 'production'
    const e = err as Error & { cause?: unknown }
    const cause = e?.cause as { message?: string; code?: string } | undefined

    return NextResponse.json(
      {
        success: false,
        error: message.startsWith('Unauthorized') || message.startsWith('Forbidden') ? message : 'Internal error',
        ...(exposeDetails && !(message.startsWith('Unauthorized') || message.startsWith('Forbidden'))
          ? {
              detail: e?.message ?? String(err),
              cause: cause?.message ?? (cause ? String(cause) : undefined),
              causeCode: cause?.code,
              stack: e?.stack,
            }
          : {}),
      },
      { status: statusForAuthError(message) },
    )
  }
}
