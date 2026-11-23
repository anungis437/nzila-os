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
import { getCaseActor, requireKernelCaseAction } from '@/lib/cases/case-authorization';
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { buildUnionEvidencePack } from '@/lib/evidence';
import { settleUnionEvidencePack } from '@/lib/evidence-settlement';
import { trackPilotEvent } from '@/lib/services/pilot-tracking';
import {
  validateTransition,
} from "@/lib/workflow/case-lifecycle";
import { caseLifecycleActorRole } from '@/lib/workflow/claim-transition-policy';
import { storedCaseTransitionFacts } from '@/lib/workflow/claim-transition-facts';
import { toLifecycleState } from "@/lib/workflow/state-bridge";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and, desc, inArray } from "drizzle-orm";

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
      const actor = await getCaseActor();
      if (actor.userId !== userId || actor.organizationId !== organizationId) {
        throw ApiError.forbidden('The case actor must match the current organization session');
      }
      const actorRole = caseLifecycleActorRole(actor.role);
      if (!actorRole) throw ApiError.forbidden('Unknown case workflow role');
      // Read the status clock from immutable state events. Editing the case or
      // adding a document must not restart or disable its waiting period.
      const [lastStateEvent] = await tx.select({ createdAt: grievanceEvents.createdAt })
        .from(grievanceEvents).where(and(eq(grievanceEvents.grievanceId, grievanceId),
          inArray(grievanceEvents.eventType, ['status_changed', 'converted_to_case', 'closed'])))
        .orderBy(desc(grievanceEvents.createdAt)).limit(1);
      const transitionFacts = storedCaseTransitionFacts({
        claimId: grievanceId, status: currentStatus,
        description: grievance.description, assignedTo: grievance.unionRepId,
        memberId: grievance.representedMemberUserId, priority: grievance.priority === 'urgent' ? 'critical' : grievance.priority ?? 'medium',
        createdAt: grievance.createdAt, updatedAt: grievance.updatedAt,
        statusChangedAt: lastStateEvent?.createdAt ?? grievance.createdAt,
      }, unifiedCurrent, notes);
      const result = validateTransition({ actorRole, caseId: grievanceId,
        currentState: unifiedCurrent, targetState: unifiedTarget, assignedTo: grievance.unionRepId,
        ...transitionFacts });
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
