/**
 * Case Assignment API — POST /api/cases/[caseId]/assign
 *
 * Assign or reassign a case to a steward/officer.
 *
 * PR-021: Queue & Assignment Workflow Polish
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { claims, claimUpdates } from '@/db/schema/claims-schema';
import { claimHistoryReference } from '@/lib/cases/claim-history-reference';
import { auditDataMutation } from '@/lib/audit-logger';
import { logger } from '@/lib/logger';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { recordUnionEyesCaseAssigned } from '@/lib/pilot-metrics';
import { getCaseActor, requireCaseAction, findReadableCase, caseAssigneeEligible, denyCaseAction, caseAuthorizationResponse } from '@/lib/cases/case-authorization';
import { authorizationDenialResponse } from '@/lib/api/authorization-denial';

export const dynamic = 'force-dynamic';

const AssignCaseSchema = z.object({
  assigneeId: z.string().min(1, 'Assignee ID is required').max(255),
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

    const actor = await getCaseActor();
    const {userId,organizationId:orgId} = actor;
    await requireCaseAction(actor,'case_assign',caseId);
    await requireEntitlement(orgId, 'grievance_case_suite');

    let body: any;
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
      const claim = await findReadableCase(tx,actor,caseId,true);

      if (!claim) return null;
      if (!(await caseAssigneeEligible(tx,actor,assigneeId)))
        return {denied:true as const,claimId:claim.claimId};

      const previousAssignee = claim.assignedTo;

      // Update assignment
      await tx
        .update(claims)
        .set({
          assignedTo: assigneeId,
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(claims.claimId, claim.claimId));

      // Add assignment note
      const [update] = await tx
        .insert(claimUpdates)
        .values({
          claimId: claimHistoryReference(claim.claimId),
          updateType: 'assignment',
          message: reason
            ? `Case assigned. Reason: ${reason}`
            : 'Case assigned.',
          createdBy: userId,
          isInternal: true,
          visibilityScope: 'staff',
        })
        .returning();

      return { denied:false as const,claimId:claim.claimId,previousAssignee, updateId: update.updateId };
    });

    if (!result) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Case '${caseId}' not found.` },
        { status: 404 },
      );
    }
    if(result.denied) return await denyCaseAction(actor,'case_assign',result.claimId,'Assignee is not an active canonical representative in this organization');

    await auditDataMutation({
      userId,
      organizationId: orgId,
      resource: 'claims',
      resourceId: result.claimId,
      action: 'update',
      details: {
        event: 'CASE_ASSIGNED',
        caseId: result.claimId,
        fromAssignee: result.previousAssignee,
        toAssignee: assigneeId,
        reason: reason ?? null,
        updatedBy: userId,
      },
    });

    logger.info('Case assigned', {
      caseId: result.claimId,
      fromAssignee: result.previousAssignee,
      toAssignee: assigneeId,
    });

    const traceId = request.headers.get('x-trace-id') ?? crypto.randomUUID();

    // Evidence: case assignment audit trail
    buildUnionEvidencePack({
      actionType: 'CASE_ASSIGNED',
      orgId: orgId,
      actorId: userId,
      artifacts: [{ type: 'case_assignment', data: { caseId: result.claimId, fromAssignee: result.previousAssignee, toAssignee: assigneeId } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'CASE_ASSIGNED' }))

    recordUnionEyesCaseAssigned(orgId, result.claimId, assigneeId, userId, traceId).catch((err) =>
      logger.warn('Pilot metric emit failed', { error: String(err), metric: 'assignment_efficiency' }),
    )

    return NextResponse.json(
      {
        success: true,
        caseId: result.claimId,
        assignedTo: assigneeId,
        previousAssignee: result.previousAssignee,
      },
      { status: 200 },
    );
  } catch (error) {
    const denied=caseAuthorizationResponse(error)??authorizationDenialResponse(error);
    if(denied) return denied;
    logger.error('Failed to assign case', error as Error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
