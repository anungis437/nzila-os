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
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { requireKernelCaseAction } from '@/lib/cases/case-authorization';
import { auditLog, AuditEventType, AuditSeverity } from "@/lib/audit-logger";
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { settleUnionEvidencePack } from '@/lib/evidence-settlement';
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
import { randomBytes } from 'crypto';

const convertSchema = z.object({
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  notes: z.string().optional(),
});

export const POST = withApi(
  {
    // No role floor: the authority kernel decides who may move an intake (requireKernelCaseAction below).
    auth: { required: true },
    entitlement: 'grievance_case_suite',
    // The intake is read through the ambient handle, so the handler runs in the caller's organization transaction.
    rlsOrgContext: true,
    openapi: { tags: ['Grievances'], summary: 'Convert an intake into an official case' },
  },
  async ({ request, params, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }
    const intakeId = params.id;
    if (!intakeId || !zUUID.safeParse(intakeId).success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid intake ID");
    }

    const parsed = convertSchema.safeParse(await request.json());
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid input", parsed.error.flatten());
    }

    // Fetch the intake
    const [intake] = await db
      .select()
      .from(grievances)
      .where(
        and(
          eq(grievances.id, intakeId),
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
      caseId: intakeId,
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

    let result;
    try {
      result = await withRLSContext({ organizationId }, async (tx) => {
        // The kernel decides this actor may move this intake: a live assignment or mandate, never a role rank.
        await requireKernelCaseAction(tx, { userId, organizationId }, intakeId, 'case:transition');
        // Mark the intake as converted, but only from the status that was validated: a second conversion that raced this one finds it already moved.
        const converted = await tx
          .update(grievances)
          .set({ status: 'converted', updatedAt: new Date() })
          .where(and(eq(grievances.id, intakeId), eq(grievances.organizationId, organizationId), eq(grievances.status, intake.status)))
          .returning({ id: grievances.id });
        if (converted.length === 0) throw ApiError.conflict('The intake changed while it was being converted');

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
            // Retain the originating member separately from the staff converter's actual authorship.
            grievantId: zUUID.safeParse(intake.grievantId ?? intake.createdBy).success
              ? (intake.grievantId ?? intake.createdBy) : null,
            grievantName: intake.grievantName ?? null,
            grievantEmail: intake.grievantEmail ?? null,
            filedDate: new Date(),
            relatedGrievanceIds: [intakeId],
          })
          .returning();

        // Emit lifecycle events
        await tx.insert(grievanceEvents).values([
          {
            grievanceId: intakeId,
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
          resourceId: intakeId,
          details: { intakeId, newCaseId: officialCase.id, newCaseNumber: officialCase.grievanceNumber },
        });
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'grievance.create_official_case',
          resourceType: 'grievances',
          resourceId: officialCase.id,
          details: {
            caseNumber: officialCase.grievanceNumber,
            sourceIntakeId: intakeId,
            sourceIntakeNumber: intake.grievanceNumber,
            initialPriority: officialCase.priority ?? null,
          },
        });

        return officialCase;
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'FORBIDDEN') {
        await auditLog({ eventType: AuditEventType.AUTHORITY_VIOLATION, severity: AuditSeverity.HIGH, userId, organizationId, resource: 'grievances', action: 'convert_intake', resourceId: intakeId, details: { reason: 'The authority kernel did not authorize this conversion' }, outcome: 'failure' });
        return standardErrorResponse(ErrorCode.FORBIDDEN, "The authority kernel did not authorize this conversion.");
      }
      throw error;
    }

    // Evidence pack
    await settleUnionEvidencePack(buildUnionEvidencePack({
      actionType: 'INTAKE_CONVERTED',
      orgId: organizationId,
      actorId: userId,
      artifacts: [
        { type: 'grievance', data: { intakeId, caseId: result.id, caseNumber: result.grievanceNumber } },
      ],
    }), 'INTAKE_CONVERTED');

    return standardSuccessResponse(result);
  },
);
