/**
 * Case Assignment API — POST /api/cases/[caseId]/assign
 *
 * Assign or reassign a case to a steward/officer.
 *
 * PR-021: Queue & Assignment Workflow Polish
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { claims, claimUpdates } from '@/db/schema/claims-schema';
import { claimHistoryReference } from '@/lib/cases/claim-history-reference';
import { logger } from '@/lib/logger';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { recordUnionEyesCaseAssigned } from '@/lib/pilot-metrics';
import { getCaseActor, findReadableCase, caseAssigneeEligible, denyCaseAction, caseAuthorizationResponse } from '@/lib/cases/case-authorization';
import { authorizationDenialResponse } from '@/lib/api/authorization-denial';
import { assignPrimaryRepresentative } from '@/lib/services/case-access-service';
import { AuthorityStoreError } from '@/lib/authority/store/executor';

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
      // The kernel decides the caller may assign this case (a mandate or delegation naming assignment).
      const claim = await findReadableCase(tx,actor,caseId,true,'case:assign');

      if (!claim) return null;
      if (!(await caseAssigneeEligible(tx,actor,assigneeId)))
        return {denied:true as const,claimId:claim.claimId};

      // The kernel owns the assignment: it re-decides the issuer's authority, the assignee's capacity and conflicts, and
      // records the governed relationship. The claims column below is only a compatibility mirror.
      let previousAssignee = claim.assignedTo;

      // A person cannot route their own matter, or give a member their own matter.
      if (claim.memberId === userId || claim.memberId === assigneeId)
        return {denied:true as const,conflict:true as const,claimId:claim.claimId};

      const kernel = await assignPrimaryRepresentative(tx, { organizationId: orgId, grievanceId: claim.claimId, issuerUserId: userId, assigneeUserId: assigneeId });
      // The kernel is the record of who holds the case; the mirror may be stale or empty.
      previousAssignee = kernel.previousUserId;
      if (previousAssignee === assigneeId) {
        // The kernel already names this assignee. The mirror column is read by workflow guards, so repair it if it lags.
        if (claim.assignedTo !== assigneeId) {
          await tx
            .update(claims)
            .set({ assignedTo: assigneeId, assignedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(claims.claimId, claim.claimId), eq(claims.organizationId, orgId)));
        }
        return {unchanged:true as const,claimId:claim.claimId,assignedTo:assigneeId};
      }

      // Compare-and-set against the row locked above, so a concurrent reassignment cannot be overwritten silently.
      const [changed] = await tx
        .update(claims)
        .set({
          assignedTo: assigneeId,
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(claims.claimId, claim.claimId), eq(claims.organizationId, orgId)))
        .returning({ claimId: claims.claimId });
      if (!changed) return {conflicted:true as const,claimId:claim.claimId};

      // Durable in-transaction history of the transfer.
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

      // The audit record shares this transaction in every deployment mode: if it cannot be written the assignment
      // rolls back, so a transfer never commits unaudited.
      await persistAtomicAudit(tx, {
        organizationId: orgId,
        action: 'case.assign',
        resourceType: 'claims',
        resourceId: claim.claimId,
        userId,
        details: {
          event: 'CASE_ASSIGNED',
          caseId: claim.claimId,
          fromAssignee: previousAssignee,
          toAssignee: assigneeId,
          reason: reason ?? null,
          updatedBy: userId,
        },
      });

      return { denied:false as const,claimId:claim.claimId,previousAssignee, updateId: update.updateId };
    });

    if (!result) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Case '${caseId}' not found.` },
        { status: 404 },
      );
    }
    if ('unchanged' in result) {
      // Idempotent repeat: the requested state already holds, so nothing is written or re-audited.
      return NextResponse.json(
        { success: true, transferred: false, caseId: result.claimId, assignedTo: result.assignedTo },
        { status: 200 },
      );
    }
    if ('conflicted' in result) {
      return NextResponse.json(
        { error: 'ASSIGNMENT_CONFLICT', message: 'The case assignment changed concurrently. Reload the case and retry.', caseId: result.claimId },
        { status: 409 },
      );
    }
    if(result.denied) return await denyCaseAction(actor,'case_assign',result.claimId,
      'conflict' in result ? 'Case parties cannot assign or receive their own case' : 'Assignee is not an active canonical representative in this organization');

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
    if (error instanceof AuthorityStoreError && (error.code === 'DENIED' || error.code === 'PRECONDITION' || error.code === 'NOT_FOUND')) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'The authority kernel did not authorize this assignment.' }, { status: 403 });
    }
    const denied=caseAuthorizationResponse(error)??authorizationDenialResponse(error);
    if(denied) return denied;
    logger.error('Failed to assign case', error as Error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
