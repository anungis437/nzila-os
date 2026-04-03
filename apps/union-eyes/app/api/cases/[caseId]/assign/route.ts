/**
 * Case Assignment API — POST /api/cases/[caseId]/assign
 *
 * Assign or reassign a case to a steward/officer.
 *
 * PR-021: Queue & Assignment Workflow Polish
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { claims, claimUpdates } from '@/db/schema/claims-schema';
import { auditDataMutation } from '@/lib/audit-logger';
import { logger } from '@/lib/logger';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { buildUnionEvidencePack } from '@/lib/evidence';

export const dynamic = 'force-dynamic';

const AssignCaseSchema = z.object({
  assigneeId: z.string().min(1, 'Assignee ID is required'),
  reason: z.string().max(1000).optional(),
});

/**
 * POST /api/cases/[caseId]/assign — Assign a case to a steward/officer
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params;

    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED', message: 'Authentication required.' },
        { status: 401 },
      );
    }
    await requireEntitlement(orgId, 'grievance_case_suite');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Request body must be valid JSON.' },
        { status: 400 },
      );
    }

    const parsed = AssignCaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid assignment request.',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const { assigneeId, reason } = parsed.data;

    const result = await withRLSContext(async (tx) => {
      // Verify case exists (RLS enforces org isolation)
      const [claim] = await tx
        .select({
          claimId: claims.claimId,
          assignedTo: claims.assignedTo,
          status: claims.status,
        })
        .from(claims)
        .where(eq(claims.claimId, caseId))
        .limit(1);

      if (!claim) return null;

      const previousAssignee = claim.assignedTo;

      // Update assignment
      await tx
        .update(claims)
        .set({
          assignedTo: assigneeId,
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(claims.claimId, caseId));

      // Add assignment note
      const [update] = await tx
        .insert(claimUpdates)
        .values({
          claimId: caseId,
          updateType: 'assignment',
          message: reason
            ? `Case assigned. Reason: ${reason}`
            : 'Case assigned.',
          createdBy: userId,
          isInternal: true,
          visibilityScope: 'staff',
        })
        .returning();

      return { previousAssignee, updateId: update.updateId };
    });

    if (!result) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Case '${caseId}' not found.` },
        { status: 404 },
      );
    }

    await auditDataMutation({
      userId,
      organizationId: orgId,
      resource: 'claims',
      resourceId: caseId,
      action: 'update',
      details: {
        event: 'CASE_ASSIGNED',
        caseId,
        fromAssignee: result.previousAssignee,
        toAssignee: assigneeId,
        reason: reason ?? null,
        updatedBy: userId,
      },
    });

    logger.info('Case assigned', {
      caseId,
      fromAssignee: result.previousAssignee,
      toAssignee: assigneeId,
    });

    // Evidence: case assignment audit trail
    buildUnionEvidencePack({
      actionType: 'CASE_ASSIGNED',
      orgId: orgId,
      actorId: userId,
      artifacts: [{ type: 'case_assignment', data: { caseId, fromAssignee: result.previousAssignee, toAssignee: assigneeId } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'CASE_ASSIGNED' }))

    return NextResponse.json(
      {
        success: true,
        caseId,
        assignedTo: assigneeId,
        previousAssignee: result.previousAssignee,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error('Failed to assign case', error as Error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
