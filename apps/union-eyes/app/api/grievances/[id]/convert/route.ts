/**
 * Intake → Case Conversion API
 *
 * POST /api/grievances/[id]/convert — Convert a member intake into an official case (steward+)
 */

import { z } from "zod";
import { db } from "@/db/db";
import { withRLSContext } from '@/lib/db/with-rls-context';
import { grievances } from "@/db/schema/domains/claims/grievances";
import { grievanceEvents } from "@/db/schema/domains/claims/grievance-lifecycle";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { auditLog, AuditEventType, AuditSeverity } from "@/lib/audit-logger";
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { logger } from '@/lib/logger';
import { buildUnionEvidencePack } from '@/lib/evidence';
import {
  validateTransition,
  type LifecycleState,
} from "@/lib/workflow/case-lifecycle";
import { toLifecycleState } from "@/lib/workflow/state-bridge";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and } from "drizzle-orm";
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { randomBytes } from 'crypto';

const convertSchema = z.object({
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  notes: z.string().optional(),
});

export const POST = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    if (!params?.id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Missing ID");

    // Only steward+ can convert intakes to official cases
    const isSteward = await hasMinRole("steward");
    if (!isSteward) {
      await auditLog({
        eventType: AuditEventType.AUTHORITY_VIOLATION,
        severity: AuditSeverity.HIGH,
        userId,
        organizationId,
        resource: 'grievances',
        action: 'convert_intake',
        resourceId: params.id,
        details: { reason: 'Member attempted to convert intake to case' },
        outcome: 'failure',
      });
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Only a steward or LRO can convert an intake to an official case.");
    }

    const body = await request.json();
    const parsed = convertSchema.safeParse(body);
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid input", parsed.error.flatten());
    }

    // Fetch the intake
    const [intake] = await db
      .select()
      .from(grievances)
      .where(
        and(
          eq(grievances.id, params.id),
          eq(grievances.organizationId, organizationId),
        ),
      );

    if (!intake) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Intake not found");
    }

    // Validate FSM transition: must be in 'draft' status
    const currentStatus = intake.status as string;
    const unifiedCurrent = toLifecycleState('grievance', currentStatus);
    // 'converted' maps to 'submitted' in unified FSM
    const unifiedTarget = toLifecycleState('grievance', 'converted') ?? 'submitted' as LifecycleState;

    if (!unifiedCurrent) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Unrecognized intake status: ${currentStatus}`,
      );
    }

    const transitionResult = validateTransition({
      actorRole: 'steward',
      caseId: params.id,
      currentState: unifiedCurrent,
      targetState: unifiedTarget,
    });

    if (!transitionResult.allowed) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        transitionResult.reason ?? "Intake cannot be converted from its current status",
      );
    }

    const { priority, notes } = parsed.data;

    const result = await withRLSContext(async (tx) => {
      // Mark the intake as converted
      await tx
        .update(grievances)
        .set({ status: 'converted', updatedAt: new Date() })
        .where(eq(grievances.id, params.id));

      // Create the official case, linked back to the intake via relatedGrievanceIds
      const [officialCase] = await tx
        .insert(grievances)
        .values({
          grievanceNumber: `GRV-${Date.now()}-${randomBytes(3).toString('hex')}`,
          type: intake.type,
          title: intake.title,
          description: intake.description,
          priority: priority ?? 'medium',
          status: 'filed',
          employerId: intake.employerId ?? null,
          cbaId: intake.cbaId ?? null,
          organizationId,
          createdBy: userId,
          unionRepId: userId,
          filedDate: new Date(),
          relatedGrievanceIds: [params.id],
        })
        .returning();

      // Emit lifecycle events
      await tx.insert(grievanceEvents).values([
        {
          grievanceId: params.id,
          eventType: 'converted_to_case',
          actorUserId: userId,
          notes: notes ?? `Intake converted to official case ${officialCase.grievanceNumber}`,
        },
        {
          grievanceId: officialCase.id,
          eventType: 'created',
          actorUserId: userId,
          notes: `Official case created from intake ${intake.grievanceNumber}`,
        },
      ]);

      // Conversion, the new case and both audit records commit together.
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'grievance.convert_intake',
        resourceType: 'grievances',
        resourceId: params.id,
        details: { intakeId: params.id, newCaseId: officialCase.id, newCaseNumber: officialCase.grievanceNumber },
      });
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'grievance.create_official_case',
        resourceType: 'grievances',
        resourceId: officialCase.id,
        details: {
          caseNumber: officialCase.grievanceNumber,
          sourceIntakeId: params.id,
          sourceIntakeNumber: intake.grievanceNumber,
          initialPriority: officialCase.priority ?? null,
        },
      });

      return officialCase;
    });

    // Evidence pack
    buildUnionEvidencePack({
      actionType: 'INTAKE_CONVERTED',
      orgId: organizationId,
      actorId: userId,
      artifacts: [
        { type: 'grievance', data: { intakeId: params.id, caseId: result.id, caseNumber: result.grievanceNumber } },
      ],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'INTAKE_CONVERTED' }));

    return standardSuccessResponse(result);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to convert intake");
  }
});
