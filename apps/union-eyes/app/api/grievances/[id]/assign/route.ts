/**
 * Grievance Assignment API
 *
 * PATCH /api/grievances/[id]/assign — Assign a steward to a grievance
 */

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context';
import { grievances } from "@/db/schema/domains/claims/grievances";
import { grievanceEvents } from "@/db/schema/domains/claims/grievance-lifecycle";
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

const assignSchema = z.object({
  stewardId: z.guid(),
});

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'grievance_case_suite',
    // The assignment must commit before the convergence step runs as the system role, which cannot see an uncommitted task. The wrapper would hold the
    // whole handler in one transaction (always in the canonical state, for a route that requires an organization), so this route opens its own
    // organization transaction and checks the organization itself.
    requireOrg: false,
    registry: { audience: 'officer', orgScoping: 'caller-org' },
    openapi: { tags: ['Grievances'], summary: 'Assign a steward to a grievance' },
  },
  async ({ request, params, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }
    const grievanceId = params.id;
    if (!grievanceId || !zUUID.safeParse(grievanceId).success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid grievance ID");
    }

    const parsed = assignSchema.safeParse(await request.json());
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid input", parsed.error.flatten());
    }
    const stewardId = parsed.data.stewardId;
    const continuityCorrelationId = randomUUID();

    // The grievance check, the assignment, the caseload change, the primary-representative mirror, the case event, the audit record and the durable
    // convergence task commit together, so the assignment can never commit without a retryable record that reminders still need to converge to it.
    let committed: { assignment: unknown; convergenceTaskId: string } | null;
    try {
      committed = await withRLSContext({ organizationId }, async (tx) => {
        const [grievance] = await tx
          .select({ id: grievances.id })
          .from(grievances)
          .where(and(eq(grievances.id, grievanceId), eq(grievances.organizationId, organizationId)));
        if (!grievance) return null;

        const assignment = await assignSteward(organizationId, grievanceId, stewardId, tx);
        const assigneeUserId = assignment.stewardId;

        // The kernel decides: the officer needs case:assign authority under an adopted rule and the assignee must be an
        // eligible, conflict-free representative. A refusal throws before anything below is written.
        const { previousUserId: previousUnionRepId } = await assignPrimaryRepresentative(tx, {
          organizationId,
          grievanceId,
          issuerUserId: userId,
          assigneeUserId,
        });

        // The legacy primary-representative column is kept as a compatibility mirror for readers not yet migrated to the
        // kernel. It is never an authority source.
        await tx
          .update(grievances)
          .set({ unionRepId: assigneeUserId, updatedAt: new Date() })
          .where(and(eq(grievances.id, grievanceId), eq(grievances.organizationId, organizationId)));

        await tx.insert(grievanceEvents).values({
          grievanceId,
          eventType: "assigned",
          actorUserId: userId,
          notes: `Steward ${assigneeUserId} assigned`,
        });

        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'grievance.assign_steward',
          resourceType: 'grievances',
          resourceId: grievanceId,
          details: { stewardProfileId: stewardId, stewardId: assigneeUserId, previousUnionRepId },
        });

        const { taskId } = await requestAssignmentConvergence(tx, {
          organizationId,
          grievanceId,
          correlationId: continuityCorrelationId,
          previousAssigneeId: previousUnionRepId,
          newAssigneeId: assigneeUserId,
        });
        return { assignment, convergenceTaskId: taskId };
      });
    } catch (error) {
      if (error instanceof AuthorityStoreError && (error.code === 'DENIED' || error.code === 'PRECONDITION' || error.code === 'NOT_FOUND')) {
        return standardErrorResponse(ErrorCode.FORBIDDEN, "The authority kernel did not authorize this assignment");
      }
      throw error;
    }

    if (!committed) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Grievance not found");
    }
    const { assignment, convergenceTaskId } = committed;

    // The assignment above has committed under the tenant role. The follow-up read and update run as union_eyes_system: scoped 0019 denies an empty tenant
    // context, so this retry cannot see the new row on the ordinary pool. The reminder cron uses the same system principal for its sweep.
    // If this fails the request fails (reminder continuity is not guaranteed, so success is not claimed), and the durable task stays pending for that sweep.
    await withSystemContext(() =>
      processAssignmentConvergence(convergenceTaskId, { type: 'user', id: userId }),
    );

    buildUnionEvidencePack({
      actionType: 'GRIEVANCE_ASSIGNED',
      orgId: organizationId,
      actorId: userId,
      artifacts: [{ type: 'grievance', data: { grievanceId, stewardId } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'GRIEVANCE_ASSIGNED' }));

    return standardSuccessResponse(assignment);
  },
);
