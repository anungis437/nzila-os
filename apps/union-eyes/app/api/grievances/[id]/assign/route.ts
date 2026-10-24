/**
 * Grievance Assignment API
 *
 * POST /api/grievances/[id]/assign — Assign a steward to a grievance
 */

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db } from "@/db/db";
import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context';
import { grievances } from "@/db/schema/domains/claims/grievances";
import { grievanceEvents } from "@/db/schema/domains/claims/grievance-lifecycle";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { buildUnionEvidencePack } from '@/lib/evidence';
import { logger } from '@/lib/logger';
import { assignSteward } from "@/lib/services/steward-assignment";
import { assignPrimaryRepresentative } from "@/lib/services/case-access-service";
import { AuthorityStoreError } from "@/lib/authority/store/executor";
import { requestAssignmentConvergence, processAssignmentConvergence } from "@/lib/deadline-engine";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and } from "drizzle-orm";
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

const assignSchema = z.object({
  stewardId: z.string().uuid(),
});

export const PATCH = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    if (!params?.id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Missing ID");
    const canAssign = await hasMinRole("officer");
    if (!canAssign) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Requires officer role or above");
    }

    const body = await request.json();
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid input", parsed.error.flatten());
    }

    // Verify grievance belongs to org
    const [grievance] = await db
      .select()
      .from(grievances)
      .where(
        and(
          eq(grievances.id, params.id),
          eq(grievances.organizationId, organizationId),
        ),
      );

    if (!grievance) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Grievance not found");
    }

    const assignment = await assignSteward(organizationId, params.id, parsed.data.stewardId);
    const continuityCorrelationId = randomUUID();

    // Update grievance assigned rep AND record a durable convergence task in
    // the SAME transaction, so the assignment can never commit without a
    // retryable record that reminders still need to converge to it.
    const { taskId: convergenceTaskId, previousUnionRepId } = await withRLSContext(async (tx) => {
      // The kernel decides: the officer needs case:assign authority under an adopted rule and the assignee must be an
      // eligible, conflict-free representative. A refusal throws before anything below is written.
      const { previousUserId } = await assignPrimaryRepresentative(tx, {
        organizationId,
        grievanceId: params.id!,
        issuerUserId: userId,
        assigneeUserId: parsed.data.stewardId,
      });
      const previousUnionRepId = previousUserId;

      // The legacy primary-representative column is kept as a compatibility mirror for readers not yet migrated to the
      // kernel. It is never an authority source.
      await tx
        .update(grievances)
        .set({ unionRepId: parsed.data.stewardId, updatedAt: new Date() })
        .where(and(eq(grievances.id, params.id), eq(grievances.organizationId, organizationId)));

      // Emit event
      await tx.insert(grievanceEvents).values({
        grievanceId: params.id,
        eventType: "assigned",
        actorUserId: userId,
        notes: `Steward ${parsed.data.stewardId} assigned`,
      });

      // The assignment, its event, its convergence task and its audit record commit together.
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'grievance.assign_steward',
        resourceType: 'grievances',
        resourceId: params.id,
        details: { stewardId: parsed.data.stewardId, previousUnionRepId },
      });

      const { taskId } = await requestAssignmentConvergence(tx, {
        organizationId,
        grievanceId: params.id!,
        correlationId: continuityCorrelationId,
        previousAssigneeId: previousUnionRepId,
        newAssigneeId: parsed.data.stewardId,
      });
      return { taskId, previousUnionRepId };
    });

    // The insert above committed under the tenant role. The follow-up read and
    // update run as union_eyes_system: scoped 0019 denies an empty tenant
    // context, so this retry cannot see the new row on the ordinary pool.
    // The reminder cron uses the same system principal for its sweep.
    // If this fails, the durable task stays pending for that sweep.
    await withSystemContext(() =>
      processAssignmentConvergence(convergenceTaskId, { type: 'user', id: userId }),
    );

    buildUnionEvidencePack({
      actionType: 'GRIEVANCE_ASSIGNED',
      orgId: organizationId,
      actorId: userId,
      artifacts: [{ type: 'grievance', data: { grievanceId: params.id, stewardId: parsed.data.stewardId } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'GRIEVANCE_ASSIGNED' }));

    return standardSuccessResponse(assignment);
  } catch (error) {
    if (error instanceof AuthorityStoreError && (error.code === 'DENIED' || error.code === 'PRECONDITION' || error.code === 'NOT_FOUND')) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "The authority kernel did not authorize this assignment");
    }
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to assign representative");
  }
});
