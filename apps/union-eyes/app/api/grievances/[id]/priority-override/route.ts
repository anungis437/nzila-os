/**
 * Priority Override API
 *
 * POST /api/grievances/[id]/priority-override — Override WIL-generated priority (chief_steward+)
 */

import { z } from "zod";
import { db } from "@/db/db";
import { withRLSContext } from '@/lib/db/with-rls-context';
import { grievances } from "@/db/schema/domains/claims/grievances";
import { grievanceEvents } from "@/db/schema/domains/claims/grievance-lifecycle";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { auditLog, AuditEventType, AuditSeverity } from "@/lib/audit-logger";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and } from "drizzle-orm";
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

const overrideSchema = z.object({
  newPriority: z.enum(["low", "medium", "high", "urgent"]),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

export const POST = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    if (!params?.id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Missing ID");

    // Only chief_steward+ can override priorities
    const isChiefSteward = await hasMinRole("chief_steward");
    if (!isChiefSteward) {
      await auditLog({
        eventType: AuditEventType.AUTHORITY_VIOLATION,
        severity: AuditSeverity.HIGH,
        userId,
        organizationId,
        resource: 'grievances',
        action: 'priority_override',
        resourceId: params.id,
        details: { reason: 'Insufficient role for priority override' },
        outcome: 'failure',
      });
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Only a chief steward or above can override priorities.");
    }

    const body = await request.json();
    const parsed = overrideSchema.safeParse(body);
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid input", parsed.error.flatten());
    }

    const { newPriority, reason } = parsed.data;

    // Fetch the grievance
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

    const previousPriority = grievance.priority;

    if (previousPriority === newPriority) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "New priority must differ from current priority");
    }

    // Apply the override
    const [updated] = await withRLSContext(async () => {
      const [u] = await db
        .update(grievances)
        .set({ priority: newPriority, updatedAt: new Date() })
        .where(eq(grievances.id, params.id))
        .returning();

      await db.insert(grievanceEvents).values({
        grievanceId: params.id,
        eventType: 'priority_overridden',
        actorUserId: userId,
        notes: `Priority overridden: ${previousPriority} → ${newPriority}. Reason: ${reason}`,
      });

      return [u];
    });

    // Audit: priority overridden
    await auditLog({
      eventType: AuditEventType.CASE_PRIORITY_OVERRIDDEN,
      severity: AuditSeverity.HIGH,
      userId,
      organizationId,
      resource: 'grievances',
      action: 'priority_override',
      resourceId: params.id,
      details: {
        previousPriority,
        newPriority,
        reason,
      },
      outcome: 'success',
    });

    return standardSuccessResponse(updated);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to override priority");
  }
});
