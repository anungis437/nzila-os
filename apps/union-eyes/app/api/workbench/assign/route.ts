/**
 * POST /api/workbench/assign
 * Assign a claim under the same case_assign policy as /api/cases/[caseId]/assign.
 * The organization and role come from the authenticated membership, never the request.
 */
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { claims, claimUpdates } from '@/db/schema/claims-schema';
import { eq } from 'drizzle-orm';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { claimHistoryReference } from '@/lib/cases/claim-history-reference';
import {
  getCaseActor,
  requireCaseAction,
  findReadableCase,
  caseAssigneeEligible,
  denyCaseAction,
  caseAuthorizationResponse,
} from '@/lib/cases/case-authorization';
import { assignSchema } from './schemas';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, roles: ['steward', 'chief_steward', 'admin'] },
    openapi: {
      tags: ['Workbench'],
      summary: 'Assign a claim',
      description: 'Assign a claim to an eligible representative when the actor holds case_assign authority.',
    },
  },
  async (ctx) => {
    try {
      const parsed = assignSchema.safeParse(ctx.body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid input', details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { claimId, assignTo } = parsed.data;
      const actor = await getCaseActor();
      await requireCaseAction(actor, 'case_assign', claimId);
      const assigneeId = assignTo ?? actor.userId;

      const result = await withRLSContext(async (tx) => {
        const claim = await findReadableCase(tx, actor, claimId, true);
        if (!claim) return null;
        if (!(await caseAssigneeEligible(tx, actor, assigneeId))) {
          return { denied: true as const, claimId: claim.claimId };
        }

        await tx
          .update(claims)
          .set({ assignedTo: assigneeId, assignedAt: new Date(), status: 'assigned', updatedAt: new Date() })
          .where(eq(claims.claimId, claim.claimId));
        await tx.insert(claimUpdates).values({
          claimId: claimHistoryReference(claim.claimId),
          updateType: 'assignment',
          message: 'Case assigned.',
          createdBy: actor.userId,
          isInternal: true,
          visibilityScope: 'staff',
        });
        // The assignment, its history row and its audit record commit together.
        await persistAtomicAudit(tx, {
          organizationId: actor.organizationId,
          userId: actor.userId,
          action: 'case.assign',
          resourceType: 'claims',
          resourceId: claim.claimId,
          details: { assignedTo: assigneeId, previousAssignee: claim.assignedTo, via: 'workbench' },
        });
        return { denied: false as const, claimId: claim.claimId };
      });

      if (!result) {
        return NextResponse.json({ success: false, error: 'Claim not found' }, { status: 404 });
      }
      if (result.denied) {
        return await denyCaseAction(actor, 'case_assign', result.claimId, 'Assignee is not an active canonical representative in this organization');
      }

      return { claim: { claimId: result.claimId, assignedTo: assigneeId } };
    } catch (error) {
      const denied = caseAuthorizationResponse(error);
      if (denied) return denied;
      throw error;
    }
  },
);
