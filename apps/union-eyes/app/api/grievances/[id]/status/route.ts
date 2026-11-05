/**
 * Grievance Status Transition API
 *
 * PATCH /api/grievances/[id]/status — Advance grievance through the lifecycle FSM
 */

import { z } from "zod";
import { db } from "@/db/db";
import { withRLSContext } from '@/lib/db/with-rls-context';
import { grievances } from "@/db/schema/domains/claims/grievances";
import { grievanceEvents } from "@/db/schema/domains/claims/grievance-lifecycle";
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { hasMinRole } from "@/lib/api-auth-guard";
import { canTransitionGrievance } from "@/lib/cases/grievance-transition-authority";
import { getEffectiveCaseAccess } from "@/lib/services/case-access-service";
import { auditLog, AuditEventType, AuditSeverity } from "@/lib/audit-logger";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { buildUnionEvidencePack } from '@/lib/evidence';
import { logger } from '@/lib/logger';
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
    // No role floor: what the caller may do is the authority they hold over this matter (canTransitionGrievance below); the role only picks the FSM actor.
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

    // Fetch current grievance
    const [grievance] = await db
      .select()
      .from(grievances)
      .where(
        and(
          eq(grievances.id, grievanceId),
          eq(grievances.organizationId, organizationId),
        ),
      );

    if (!grievance) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Grievance not found");
    }

    // Role level is necessary but not sufficient: the actor needs authority over this matter.
    const caseAccess = await getEffectiveCaseAccess({ organizationId, grievanceId, userId });
    const mayTransition = canTransitionGrievance({
      isPrimaryOwner: caseAccess.isPrimaryOwner,
      accessRole: caseAccess.isSecondaryCollaborator ? caseAccess.accessRole : null,
      grievanceStatus: grievance.status as string,
      primaryRepresentativeId: grievance.unionRepId,
    });
    if (!mayTransition) {
      await auditLog({
        eventType: AuditEventType.AUTHORITY_VIOLATION,
        severity: AuditSeverity.HIGH,
        userId,
        organizationId,
        resource: "grievances",
        action: "status_transition",
        resourceId: grievanceId,
        details: { reason: "Representative has no authority over this matter", requestedStatus: newStatus },
        outcome: "failure",
      });
      return standardErrorResponse(ErrorCode.FORBIDDEN, "You do not have authority to change the status of this matter");
    }
    // Map existing status to unified FSM status via state bridge
    const currentStatus = grievance.status as string;
    const isAdmin = await hasMinRole("admin");
    const isStaff = await hasMinRole("steward");
    const actorRole = mapToActorRole(isAdmin, isStaff);

    // Translate both statuses through the state bridge
    const unifiedCurrent = toLifecycleState('grievance', currentStatus)
      ?? toLifecycleState('cupe', currentStatus);
    const unifiedTarget = toLifecycleState('grievance', newStatus)
      ?? toLifecycleState('cupe', newStatus);

    if (!unifiedCurrent || !unifiedTarget) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Unrecognized status: ${!unifiedCurrent ? currentStatus : newStatus}`,
      );
    }

    // Validate FSM transition via unified case-lifecycle
    const result = validateTransition({
      actorRole,
      caseId: grievanceId,
      currentState: unifiedCurrent,
      targetState: unifiedTarget,
      assignedTo: grievance.unionRepId,
    });

    if (!result.allowed) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, result.reason ?? "Invalid transition");
    }

    const previousState = { status: grievance.status };

    // Apply update, only from the status that was validated: a transition that raced this one finds the matter already moved.
    const [updated] = await withRLSContext({ organizationId }, async (tx) => {
      const rows = await tx
        .update(grievances)
        .set({
          status: newStatus,
          updatedAt: new Date(),
          ...(newStatus === "settled" ? { resolvedAt: new Date() } : {}),
          ...(newStatus === "closed" ? { closedAt: new Date() } : {}),
        })
        .where(and(eq(grievances.id, grievanceId), eq(grievances.organizationId, organizationId), eq(grievances.status, grievance.status)))
        .returning();
      if (rows.length === 0) throw ApiError.conflict('The grievance changed while its status was being updated');

      // Emit event
      await tx.insert(grievanceEvents).values({
        grievanceId,
        eventType: "status_changed",
        actorUserId: userId,
        notes: notes ?? `Status changed: ${currentStatus} → ${newStatus}`,
      });

      // The status change, its event and its audit record commit together.
      const intakeAction = newStatus === 'closed_no_case'
        ? 'close_intake_no_case'
        : currentStatus === 'draft' && newStatus !== 'draft' ? 'review_intake' : null;
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'grievance.status_change',
        resourceType: 'grievances',
        resourceId: grievanceId,
        details: { previousState, newState: { status: newStatus }, ...(intakeAction ? { intakeAction } : {}) },
      });

      return rows;
    });

    buildUnionEvidencePack({
      actionType: 'GRIEVANCE_STATUS_CHANGED',
      orgId: organizationId,
      actorId: userId,
      artifacts: [{ type: 'grievance', data: { grievanceId, from: currentStatus, to: newStatus } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'GRIEVANCE_STATUS_CHANGED' }));

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
