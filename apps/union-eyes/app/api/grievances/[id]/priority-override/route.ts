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
import { requireKernelCaseAction } from '@/lib/cases/case-authorization';
import { ApiError } from '@/lib/api/errors';
import { auditLog, AuditEventType, AuditSeverity } from "@/lib/audit-logger";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and } from "drizzle-orm";
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

const overrideSchema = z.object({
  newPriority: z.enum(["low", "medium", "high", "urgent"]),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

export const POST = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    if (!params?.id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Missing ID");

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

    // The override, its event and its audit record commit together.
    const [updated] = await withRLSContext(async (tx) => {
      // The kernel decides this actor may move this case: a live assignment or mandate, never a role rank.
      await requireKernelCaseAction(tx, { userId, organizationId }, params.id, 'case:transition');
      const [u] = await tx
        .update(grievances)
        .set({ priority: newPriority, updatedAt: new Date() })
        .where(and(eq(grievances.id, params.id), eq(grievances.organizationId, organizationId)))
        .returning();

      await tx.insert(grievanceEvents).values({
        grievanceId: params.id,
        eventType: 'priority_overridden',
        actorUserId: userId,
        notes: `Priority overridden: ${previousPriority} → ${newPriority}. Reason: ${reason}`,
      });

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'grievance.priority_override',
        resourceType: 'grievances',
        resourceId: params.id,
        details: { previousPriority, newPriority, reason },
      });

      return [u];
    });
    return standardSuccessResponse(updated);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'FORBIDDEN') {
      await auditLog({ eventType: AuditEventType.AUTHORITY_VIOLATION, severity: AuditSeverity.HIGH, userId, organizationId, resource: 'grievances', action: 'priority_override', resourceId: params?.id ?? '', details: { reason: 'The authority kernel did not authorize this override' }, outcome: 'failure' });
      return standardErrorResponse(ErrorCode.FORBIDDEN, "The authority kernel did not authorize this override.");
    }
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to override priority");
  }
});
