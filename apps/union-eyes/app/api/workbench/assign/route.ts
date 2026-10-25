/**
 * POST /api/workbench/assign
 * Assign a claim under the same kernel decision as /api/cases/[caseId]/assign.
 * The organization comes from the authenticated membership, never the request.
 */
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { claims, claimUpdates } from '@/db/schema/claims-schema';
import { and, eq } from 'drizzle-orm';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { claimHistoryReference } from '@/lib/cases/claim-history-reference';
import {
  getCaseActor,
  findReadableCase,
  caseAssigneeEligible,
  denyCaseAction,
  caseAuthorizationResponse,
} from '@/lib/cases/case-authorization';
import { assignSchema } from './schemas';
import { assignPrimaryRepresentative } from '@/lib/services/case-access-service';
import { AuthorityStoreError } from '@/lib/authority/store/executor';

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
      const assigneeId = assignTo ?? actor.userId;

      const result = await withRLSContext(async (tx) => {
        // The kernel decides the caller may assign this case; it then records the governed assignment itself.
        const claim = await findReadableCase(tx, actor, claimId, true, 'case:assign');
        if (!claim) return null;
        if (!(await caseAssigneeEligible(tx, actor, assigneeId))) {
          return { denied: true as const, claimId: claim.claimId };
        }
        const kernel = await assignPrimaryRepresentative(tx, { organizationId: actor.organizationId, grievanceId: claim.claimId, issuerUserId: actor.userId, assigneeUserId: assigneeId });

        await tx
          .update(claims)
          .set({ assignedTo: assigneeId, assignedAt: new Date(), status: 'assigned', updatedAt: new Date() })
          .where(and(eq(claims.claimId, claim.claimId), eq(claims.organizationId, actor.organizationId)));
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
          details: { assignedTo: assigneeId, previousAssignee: kernel.previousUserId, via: 'workbench' },
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
      if (error instanceof AuthorityStoreError && (error.code === 'DENIED' || error.code === 'PRECONDITION' || error.code === 'NOT_FOUND')) {
        return NextResponse.json({ success: false, error: 'The authority kernel did not authorize this assignment.' }, { status: 403 });
      }
      const denied = caseAuthorizationResponse(error);
      if (denied) return denied;
      throw error;
    }
  },
);
