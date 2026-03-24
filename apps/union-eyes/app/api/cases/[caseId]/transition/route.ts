/**
 * Case Status Transition API — PATCH /api/cases/[caseId]/transition
 *
 * Server-side enforced status transitions using CUPE vocabulary FSM rules.
 * All transitions are validated, logged, and audited.
 *
 * PR-022: FSM Enforcement + Transition Tests
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { validateCUPETransition } from '@/lib/case-fsm-enforcement';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { db } from '@/db/db';
import { claims } from '@/db/schema/claims-schema';
import { claimUpdates } from '@/db/schema/claims-schema';
import { auditDataMutation } from '@/lib/audit-logger';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const TransitionRequestSchema = z.object({
  targetStatus: z.string().min(1, 'Target status is required'),
  reason: z.string().max(2000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params;

    // 1. Auth
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED', message: 'Authentication required.' },
        { status: 401 },
      );
    }

    // 2. Parse + validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Request body must be valid JSON.' },
        { status: 400 },
      );
    }

    const parsed = TransitionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid transition request.',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const { targetStatus, reason } = parsed.data;

    // 3. Load claim in RLS context
    const result = await withRLSContext(async (tx) => {
      const [claim] = await tx
        .select({
          claimId: claims.claimId,
          status: claims.status,
          priority: claims.priority,
          organizationId: claims.organizationId,
          assignedTo: claims.assignedTo,
        })
        .from(claims)
        .where(eq(claims.claimId, caseId))
        .limit(1);

      if (!claim) {
        return { found: false as const };
      }

      // 4. Validate FSM transition
      // Map the DB status to CUPE vocabulary status
      const currentStatus = mapDbStatusToCupe(claim.status);
      const cupeTarget = targetStatus; // Already uses CUPE vocabulary IDs

      const validation = validateCUPETransition({
        caseId,
        currentStatus,
        targetStatus: cupeTarget,
        actorRole: 'steward', // TODO: resolve actual role from org membership
        reason,
      });

      if (!validation.allowed) {
        return {
          found: true as const,
          allowed: false as const,
          reason: validation.reason,
          nextAllowedStatuses: validation.nextAllowedStatuses,
        };
      }

      // 5. Apply transition
      const fromStatus = claim.status;
      const toDbStatus = mapCupeToDbStatus(cupeTarget);

      const now = new Date();
      await tx
        .update(claims)
        .set({
          status: toDbStatus,
          updatedAt: now,
          ...(cupeTarget === 'closed' ? { closedAt: now } : {}),
          ...(cupeTarget === 'settled' || cupeTarget === 'denied'
            ? { resolvedAt: now }
            : {}),
        })
        .where(eq(claims.claimId, caseId));

      // 6. Add transition note
      await tx.insert(claimUpdates).values({
        claimId: caseId,
        updateType: 'status_change',
        message: reason
          ? `Status changed: ${fromStatus} → ${toDbStatus}. Reason: ${reason}`
          : `Status changed: ${fromStatus} → ${toDbStatus}`,
        createdBy: userId,
        isInternal: false,
        visibilityScope: 'member',
        metadata: {
          fromStatus,
          toStatus: toDbStatus,
          cupeFromStatus: currentStatus,
          cupeToStatus: cupeTarget,
          reason: reason ?? null,
        },
      });

      return {
        found: true as const,
        allowed: true as const,
        fromStatus,
        toStatus: toDbStatus,
        cupeFromStatus: currentStatus,
        cupeToStatus: cupeTarget,
        claimId: caseId,
      };
    });

    // Handle not found
    if (!result.found) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Case '${caseId}' not found.` },
        { status: 404 },
      );
    }

    // Handle disallowed
    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'TRANSITION_DENIED',
          message: result.reason,
          nextAllowedStatuses: result.nextAllowedStatuses,
        },
        { status: 403 },
      );
    }

    // 7. Audit trail (outside RLS context — audit logger has its own)
    await auditDataMutation({
      userId,
      organizationId: orgId,
      resource: 'claims',
      resourceId: caseId,
      action: 'update',
      details: {
        event: 'CASE_TRANSITIONED',
        from: result.fromStatus,
        to: result.toStatus,
        cupeFrom: result.cupeFromStatus,
        cupeTo: result.cupeToStatus,
        reason: reason ?? null,
      },
    });

    logger.info('Case transitioned', {
      claimId: caseId,
      from: result.fromStatus,
      to: result.toStatus,
    });

    return NextResponse.json({
      success: true,
      claimId: caseId,
      fromStatus: result.cupeFromStatus,
      toStatus: result.cupeToStatus,
    });
  } catch (error) {
    logger.error('Case transition failed', error as Error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}

// ─── Status Mapping ───────────────────────────────────────────────────────────

/**
 * Map DB claim_status enum values to CUPE vocabulary status IDs.
 */
function mapDbStatusToCupe(dbStatus: string): string {
  const mapping: Record<string, string> = {
    submitted: 'filed',
    under_review: 'acknowledged',
    assigned: 'acknowledged',
    investigation: 'investigating',
    pending_documentation: 'response_due',
    resolved: 'settled',
    rejected: 'denied',
    closed: 'closed',
  };
  return mapping[dbStatus] ?? dbStatus;
}

/**
 * Map CUPE vocabulary status IDs back to DB claim_status enum values.
 */
function mapCupeToDbStatus(cupeStatus: string): string {
  const mapping: Record<string, string> = {
    draft: 'submitted',
    filed: 'submitted',
    acknowledged: 'under_review',
    investigating: 'investigation',
    response_due: 'pending_documentation',
    escalated: 'under_review',
    mediation: 'investigation',
    arbitration: 'investigation',
    settled: 'resolved',
    denied: 'rejected',
    withdrawn: 'closed',
    closed: 'closed',
  };
  return mapping[cupeStatus] ?? cupeStatus;
}
