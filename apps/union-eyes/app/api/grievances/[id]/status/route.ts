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
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { auditDataMutation, auditLog, AuditEventType, AuditSeverity } from "@/lib/audit-logger";
import { buildUnionEvidencePack } from '@/lib/evidence';
import { logger } from '@/lib/logger';
import {
  validateTransition,
  type LifecycleState,
  type ActorRole,
} from "@/lib/workflow/case-lifecycle";
import { toLifecycleState } from "@/lib/workflow/state-bridge";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and } from "drizzle-orm";
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

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

export const PATCH = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    if (!params?.id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Missing ID");
    const body = await request.json();
    const parsed = statusSchema.safeParse(body);
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
          eq(grievances.id, params.id),
          eq(grievances.organizationId, organizationId),
        ),
      );

    if (!grievance) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Grievance not found");
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
      caseId: params.id,
      currentState: unifiedCurrent,
      targetState: unifiedTarget,
      assignedTo: grievance.unionRepId,
    });

    if (!result.allowed) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, result.reason ?? "Invalid transition");
    }

    const previousState = { status: grievance.status };

    // Apply update
    const [updated] = await withRLSContext(async () => {
      const [u] = await db
        .update(grievances)
        .set({
          status: newStatus,
          updatedAt: new Date(),
          ...(newStatus === "settled" ? { resolvedAt: new Date() } : {}),
          ...(newStatus === "closed" ? { closedAt: new Date() } : {}),
        })
        .where(eq(grievances.id, params.id))
        .returning();

      // Emit event
      await db.insert(grievanceEvents).values({
        grievanceId: params.id,
        eventType: "status_changed",
        actorUserId: userId,
        notes: notes ?? `Status changed: ${currentStatus} → ${newStatus}`,
      });

      return [u];
    });

    // Audit
    await auditDataMutation({
      userId,
      organizationId,
      resource: "grievances",
      action: "update",
      resourceId: params.id,
      previousState,
      newState: { status: newStatus },
    });

    // Emit specific audit events for intake/case lifecycle transitions
    if (newStatus === 'closed_no_case') {
      await auditLog({
        eventType: AuditEventType.INTAKE_CLOSED,
        severity: AuditSeverity.MEDIUM,
        userId,
        organizationId,
        resource: 'grievances',
        action: 'close_intake_no_case',
        resourceId: params.id,
        details: { previousStatus: currentStatus },
        outcome: 'success',
      });
    } else if (currentStatus === 'draft' && newStatus !== 'draft') {
      await auditLog({
        eventType: AuditEventType.INTAKE_REVIEWED,
        severity: AuditSeverity.MEDIUM,
        userId,
        organizationId,
        resource: 'grievances',
        action: 'review_intake',
        resourceId: params.id,
        details: { newStatus },
        outcome: 'success',
      });
    }

    buildUnionEvidencePack({
      actionType: 'GRIEVANCE_STATUS_CHANGED',
      orgId: organizationId,
      actorId: userId,
      artifacts: [{ type: 'grievance', data: { grievanceId: params.id, from: currentStatus, to: newStatus } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'GRIEVANCE_STATUS_CHANGED' }));

    return standardSuccessResponse(updated);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to update grievance status");
  }
});
