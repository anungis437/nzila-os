/**
 * Grievance Status Transition API
 *
 * PATCH /api/grievances/[id]/status — Advance grievance through the lifecycle FSM
 */

import { z } from "zod";
import { withRLSContext } from '@/lib/db/with-rls-context';
import { grievances } from "@/db/schema/domains/claims/grievances";
import { grievanceEvents } from "@/db/schema/domains/claims/grievance-lifecycle";
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { hasMinRole } from "@/lib/api-auth-guard";
import { requireKernelCaseAction } from '@/lib/cases/case-authorization';
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { buildUnionEvidencePack } from '@/lib/evidence';
import { settleUnionEvidencePack } from '@/lib/evidence-settlement';
import { trackPilotEvent } from '@/lib/services/pilot-tracking';
import {
  validateTransition,
  type ActorRole,
} from "@/lib/workflow/case-lifecycle";
import { toLifecycleState } from "@/lib/workflow/state-bridge";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and } from "drizzle-orm";

// Map UE roles to unified FSM actor roles
function mapToActorRole(hasAdmin: boolean, hasStaff: boolean): ActorRole {
  if (hasAdmin) return "admin";
  if (hasStaff) return "steward";
  return "member";
}

const statusSchema = z.object({
  status: z.enum([
    "draft", "converted", "closed_no_case",
    "new", "filed", "acknowledged", "investigating",
    "response_due", "response_received", "escalated",
    "mediation", "arbitration", "settled", "withdrawn", "denied", "closed",
  ]),
  notes: z.string().optional(),
});

export const PATCH = withApi(
  {
    // No role floor: explicit live kernel actions authorize the matter; role only narrows the FSM.
    auth: { required: true },
    entitlement: 'grievance_case_suite',
    // The grievance is read through the ambient handle, so the handler runs in the caller's organization transaction.
    rlsOrgContext: true,
    openapi: { tags: ['Grievances'], summary: 'Advance a grievance through the lifecycle' },
  },
  async ({ request, params, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }
    const grievanceId = params.id;
    if (!grievanceId || !zUUID.safeParse(grievanceId).success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid grievance ID");
    }
    const parsed = statusSchema.safeParse(await request.json());
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid status", parsed.error.flatten());
    }

    const { status: newStatus, notes } = parsed.data;

    // Lock, authorize and mutate on the same tenant transaction. Relationship labels,
    // legacy primary columns and an unassigned draft never confer transition authority.
    const outcome = await withRLSContext({ organizationId }, async (tx) => {
      const [grievance] = await tx.select().from(grievances).where(and(
        eq(grievances.id, grievanceId), eq(grievances.organizationId, organizationId),
      )).for('update');
      if (!grievance) return { response: standardErrorResponse(ErrorCode.NOT_FOUND, "Grievance not found") };

      await requireKernelCaseAction(tx, { userId, organizationId }, grievanceId, 'case:transition');
      const currentStatus = grievance.status as string;
      const unifiedCurrent = toLifecycleState('grievance', currentStatus) ?? toLifecycleState('cupe', currentStatus);
      const unifiedTarget = toLifecycleState('grievance', newStatus) ?? toLifecycleState('cupe', newStatus);
      if (!unifiedCurrent || !unifiedTarget) return { response: standardErrorResponse(
        ErrorCode.VALIDATION_ERROR, `Unrecognized status: ${!unifiedCurrent ? currentStatus : newStatus}`,
      ) };
      // Denied/withdrawn/closed_no_case are legacy spellings of closure; reopening is
      // equally consequential. None may bypass the primary-handler-only action.
      if (unifiedTarget === 'closed' || unifiedCurrent === 'closed') {
        await requireKernelCaseAction(tx, { userId, organizationId }, grievanceId, 'case:close');
      }
      const actorRole = mapToActorRole(await hasMinRole("admin"), await hasMinRole("steward"));
      const result = validateTransition({ actorRole, caseId: grievanceId,
        currentState: unifiedCurrent, targetState: unifiedTarget, assignedTo: grievance.unionRepId });
      if (!result.allowed) return { response: standardErrorResponse(ErrorCode.VALIDATION_ERROR, result.reason ?? "Invalid transition") };

      const rows = await tx.update(grievances).set({ status: newStatus, updatedAt: new Date(),
        ...(unifiedTarget === 'resolved' ? { resolvedAt: new Date() } : {}),
        ...(unifiedTarget === 'closed' ? { closedAt: new Date() } : {}),
      }).where(and(eq(grievances.id, grievanceId), eq(grievances.organizationId, organizationId),
        eq(grievances.status, grievance.status))).returning();
      if (!rows.length) throw ApiError.conflict('The grievance changed while its status was being updated');
      await tx.insert(grievanceEvents).values({ grievanceId, eventType: "status_changed", actorUserId: userId,
        // The member-readable event contains the state only; confidential reasons stay in the restricted audit.
        notes: `Status changed: ${currentStatus} → ${newStatus}` });
      const intakeAction = newStatus === 'closed_no_case' ? 'close_intake_no_case'
        : currentStatus === 'draft' && newStatus !== 'draft' ? 'review_intake' : null;
      await persistAtomicAudit(tx, { organizationId, userId, action: 'grievance.status_change',
        resourceType: 'grievances', resourceId: grievanceId,
        details: { previousState: { status: currentStatus }, newState: { status: newStatus },
          reason: notes ?? null, ...(intakeAction ? { intakeAction } : {}) } });
      return { updated: rows[0], currentStatus };
    });
    if ('response' in outcome) return outcome.response;
    const { updated, currentStatus } = outcome;

    await settleUnionEvidencePack(buildUnionEvidencePack({
      actionType: 'GRIEVANCE_STATUS_CHANGED',
      orgId: organizationId,
      actorId: userId,
      artifacts: [{ type: 'grievance', data: { grievanceId, from: currentStatus, to: newStatus } }],
    }), 'GRIEVANCE_STATUS_CHANGED');

    await trackPilotEvent({
      userId,
      organizationId,
      sessionId: `server:${grievanceId}`,
      eventType: 'case_transitioned',
      metadata: {
        grievanceId,
        fromStatus: currentStatus,
        toStatus: newStatus,
      },
    });

    if (newStatus === 'closed' || newStatus === 'settled' || newStatus === 'withdrawn' || newStatus === 'denied') {
      await trackPilotEvent({
        userId,
        organizationId,
        sessionId: `server:${grievanceId}`,
        eventType: 'case_closed',
        metadata: {
          grievanceId,
          finalStatus: newStatus,
        },
      });
    }

    return standardSuccessResponse(updated);
  },
);
