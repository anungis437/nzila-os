/**
 * Case Status Transition API — PATCH /api/cases/[caseId]/transition
 *
 * Server-side enforced status transitions using CUPE vocabulary FSM rules.
 * All transitions are validated, logged, and audited.
 *
 * PR-022: FSM Enforcement + Transition Tests
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  validateTransition,
  getAllowedTransitions,
  type ActorRole,
  type CasePriority,
} from '@/lib/workflow/case-lifecycle';
import { toLifecycleState } from '@/lib/workflow/state-bridge';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { claims, claimUpdates, claimStatusEnum } from '@/db/schema/claims-schema';
import { auditDataMutation, auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { canPerformAction } from '@/lib/action-enforcer';
import { logger } from '@/lib/logger';
import { getCaseActor, findReadableCase, requireCaseAction, caseAuthorizationResponse } from '@/lib/cases/case-authorization';
import { authorizationDenialResponse } from '@/lib/api/authorization-denial';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { claimHistoryReference } from '@/lib/cases/claim-history-reference';

export const dynamic = 'force-dynamic';

const TransitionRequestSchema = z.object({
  targetStatus: z.string().min(1, 'Target status is required'),
  reason: z.string().max(2000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params;

    // 1. Auth
    const actor = await getCaseActor();
    const { userId, organizationId: orgId } = actor;
    await requireCaseAction(actor, 'case_transition', caseId);
    await requireEntitlement(orgId, 'grievance_case_suite');

    // 2. Parse + validate body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Request body must be valid JSON.' },
        { status: 400 },
      );
    }

    const parsed = TransitionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid transition request.',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const { targetStatus, reason } = parsed.data;

    // 3. Load claim in RLS context (with row lock to prevent TOCTOU race)
    const result = await withRLSContext(async (tx) => {
      const claim = await findReadableCase(tx, actor, caseId, true);

      if (!claim) {
        return { found: false as const };
      }

      // 5. Validate FSM transition via canonical case-lifecycle.ts
      const cupeCurrentStatus = mapDbStatusToCupe(claim.status);
      const currentLifecycleState = toLifecycleState('cupe', cupeCurrentStatus) ?? 'submitted';
      const targetLifecycleState = toLifecycleState('cupe', targetStatus);

      if (!targetLifecycleState) {
        return {
          found: true as const,
          allowed: false as const,
          reason: `Unknown or invalid target status: ${targetStatus}`,
          nextAllowedStatuses: [] as string[],
        };
      }

      const normalizedRole = normalizeActorRole(actor.role);
      const action = targetLifecycleState === 'closed' ? 'case_close'
        : currentLifecycleState === 'closed' ? 'case_reopen' : 'case_transition';
      const permission = canPerformAction(action, actor.role, { caseStatus: claim.status });
      if (!permission.allowed) return {
        found: true as const, allowed: false as const,
        reason: permission.reason, nextAllowedStatuses: [] as string[],
      };
      const validation = validateTransition({
        caseId,
        currentState: currentLifecycleState,
        targetState: targetLifecycleState,
        actorRole: normalizedRole,
        assignedTo: claim.assignedTo,
        priority: (claim.priority as CasePriority) ?? 'medium',
        notes: reason,
      });

      if (!validation.allowed) {
        const allowedLifecycleStates = getAllowedTransitions(currentLifecycleState, normalizedRole);
        return {
          found: true as const,
          allowed: false as const,
          reason: validation.reason,
          nextAllowedStatuses: allowedLifecycleStates.map(toCupeVocabulary),
        };
      }

      // 5. Apply transition
      const fromStatus = claim.status;
      const toDbStatus = mapCupeToDbStatus(targetStatus);

      const now = new Date();
      await tx
        .update(claims)
        .set({
          status: toDbStatus as typeof claimStatusEnum.enumValues[number],
          updatedAt: now,
          ...(targetStatus === 'closed' ? { closedAt: now } : {}),
          ...(targetStatus === 'settled' || targetStatus === 'denied'
            ? { resolvedAt: now }
            : {}),
        })
        .where(eq(claims.claimId, claim.claimId));

      // 6. Add transition note
      await tx.insert(claimUpdates).values({
        claimId: claimHistoryReference(claim.claimId),
        updateType: 'status_change',
        message: reason
          ? `Status changed: ${fromStatus} → ${toDbStatus}. Reason: ${reason}`
          : `Status changed: ${fromStatus} → ${toDbStatus}`,
        createdBy: userId,
        isInternal: false,
        visibilityScope: 'member',
        metadata: {
          fromStatus,
          toStatus: toDbStatus,
          cupeFromStatus: cupeCurrentStatus,
          cupeToStatus: targetStatus,
          reason: reason ?? null,
        },
      });

      return {
        found: true as const,
        allowed: true as const,
        fromStatus,
        toStatus: toDbStatus,
        cupeFromStatus: cupeCurrentStatus,
        cupeToStatus: targetStatus,
        claimId: claim.claimId,
      };
    });

    // Handle not found
    if (!result.found) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Case '${caseId}' not found.` },
        { status: 404 },
      );
    }

    // Handle disallowed
    if (!result.allowed) {
      await auditLog({
        eventType: AuditEventType.AUTH_FAILED, severity: AuditSeverity.HIGH,
        userId, organizationId: orgId, resource: 'claims', resourceId: caseId,
        action: 'case_transition', outcome: 'failure', details: { reason: result.reason, targetStatus },
      });
      return NextResponse.json(
        {
          error: 'TRANSITION_DENIED',
          message: result.reason,
          nextAllowedStatuses: result.nextAllowedStatuses,
        },
        { status: 403 },
      );
    }

    // 7. Audit trail (outside RLS context — audit logger has its own)
    await auditDataMutation({
      userId,
      organizationId: orgId,
      resource: 'claims',
      resourceId: result.claimId,
      action: 'update',
      details: {
        event: 'CASE_TRANSITIONED',
        from: result.fromStatus,
        to: result.toStatus,
        cupeFrom: result.cupeFromStatus,
        cupeTo: result.cupeToStatus,
        reason: reason ?? null,
      },
    });

    logger.info('Case transitioned', {
      claimId: result.claimId,
      from: result.fromStatus,
      to: result.toStatus,
    });

    // Evidence: case status transition audit trail
    buildUnionEvidencePack({
      actionType: 'CASE_TRANSITIONED',
      orgId: orgId,
      actorId: userId,
      artifacts: [{ type: 'case_transition', data: { caseId: result.claimId, from: result.cupeFromStatus, to: result.cupeToStatus, reason } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'CASE_TRANSITIONED' }))

    return NextResponse.json({
      success: true,
      claimId: result.claimId,
      fromStatus: result.cupeFromStatus,
      toStatus: result.cupeToStatus,
    });
  } catch (error) {
    const denied = caseAuthorizationResponse(error) ?? authorizationDenialResponse(error);
    if (denied) return denied;
    logger.error('Case transition failed', error as Error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}

// ─── FSM Role Normalization ───────────────────────────────────────────────────

/**
 * Normalize DB/org role strings to canonical ActorRole for case-lifecycle FSM.
 * Maps legacy role names to the unified vocabulary.
 */
function normalizeActorRole(role: string): ActorRole {
  const map: Record<string, ActorRole> = {
    platform_admin: 'system_admin',
    business_agent: 'chief_steward',
    union_admin: 'admin',
    union_staff: 'steward',
  };
  return (map[role] ?? role) as ActorRole;
}

/**
 * Convert a LifecycleState back to the CUPE vocabulary ID for API responses.
 */
function toCupeVocabulary(state: string): string {
  const map: Record<string, string> = {
    draft: 'draft',
    submitted: 'filed',
    triage: 'acknowledged',
    investigation: 'investigating',
    pending_docs: 'response_due',
    negotiation: 'response_due',
    mediation: 'mediation',
    arbitration: 'escalated',
    resolved: 'settled',
    closed: 'closed',
  };
  return map[state] ?? state;
}

// ─── Status Mapping ───────────────────────────────────────────────────────────

/**
 * Map DB claim_status enum values to CUPE vocabulary status IDs.
 */
function mapDbStatusToCupe(dbStatus: string): string {
  const mapping: Record<string, string> = {
    submitted: 'filed',
    under_review: 'acknowledged',
    assigned: 'acknowledged',
    investigation: 'investigating',
    pending_documentation: 'response_due',
    resolved: 'settled',
    rejected: 'denied',
    closed: 'closed',
  };
  return mapping[dbStatus] ?? dbStatus;
}

/**
 * Map CUPE vocabulary status IDs back to DB claim_status enum values.
 */
function mapCupeToDbStatus(cupeStatus: string): string {
  const mapping: Record<string, string> = {
    draft: 'submitted',
    filed: 'submitted',
    acknowledged: 'under_review',
    investigating: 'investigation',
    response_due: 'pending_documentation',
    escalated: 'under_review',
    mediation: 'investigation',
    arbitration: 'investigation',
    settled: 'resolved',
    denied: 'rejected',
    withdrawn: 'closed',
    closed: 'closed',
  };
  return mapping[cupeStatus] ?? cupeStatus;
}
