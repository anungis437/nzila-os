/**
 * Priority Override API
 *
 * POST /api/grievances/[id]/priority-override — Override WIL-generated priority (the authority kernel decides who may)
 */

import { z } from "zod";
import { db } from "@/db/db";
import { withRLSContext } from '@/lib/db/with-rls-context';
import { grievances } from "@/db/schema/domains/claims/grievances";
import { grievanceEvents } from "@/db/schema/domains/claims/grievance-lifecycle";
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { requireKernelCaseAction } from '@/lib/cases/case-authorization';
import { auditLog, AuditEventType, AuditSeverity } from "@/lib/audit-logger";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and } from "drizzle-orm";
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

const overrideSchema = z.object({
  newPriority: z.enum(["low", "medium", "high", "urgent"]),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

export const POST = withApi(
  {
    // No role floor: the authority kernel decides who may move a case (requireKernelCaseAction below).
    auth: { required: true },
    entitlement: 'grievance_case_suite',
    // The grievance is read through the ambient handle, so the handler runs in the caller's organization transaction.
    rlsOrgContext: true,
    openapi: { tags: ['Grievances'], summary: 'Override the generated priority of a grievance' },
  },
  async ({ request, params, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }
    const grievanceId = params.id;
    if (!grievanceId || !zUUID.safeParse(grievanceId).success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid grievance ID");
    }

    const parsed = overrideSchema.safeParse(await request.json());
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
          eq(grievances.id, grievanceId),
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
    let updated;
    try {
      [updated] = await withRLSContext({ organizationId }, async (tx) => {
        // The kernel decides this actor may move this case: a live assignment or mandate, never a role rank.
        await requireKernelCaseAction(tx, { userId, organizationId }, grievanceId, 'case:transition');
        const [u] = await tx
          .update(grievances)
          .set({ priority: newPriority, updatedAt: new Date() })
          .where(and(eq(grievances.id, grievanceId), eq(grievances.organizationId, organizationId)))
          .returning();

        await tx.insert(grievanceEvents).values({
          grievanceId,
          eventType: 'priority_overridden',
          actorUserId: userId,
          notes: `Priority overridden: ${previousPriority} → ${newPriority}. Reason: ${reason}`,
        });

        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'grievance.priority_override',
          resourceType: 'grievances',
          resourceId: grievanceId,
          details: { previousPriority, newPriority, reason },
        });

        return [u];
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'FORBIDDEN') {
        await auditLog({ eventType: AuditEventType.AUTHORITY_VIOLATION, severity: AuditSeverity.HIGH, userId, organizationId, resource: 'grievances', action: 'priority_override', resourceId: grievanceId, details: { reason: 'The authority kernel did not authorize this override' }, outcome: 'failure' });
        return standardErrorResponse(ErrorCode.FORBIDDEN, "The authority kernel did not authorize this override.");
      }
      throw error;
    }
    return standardSuccessResponse(updated);
  },
);
