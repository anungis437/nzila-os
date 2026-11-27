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
import { and, eq } from 'drizzle-orm';
import { toLifecycleState } from '@/lib/workflow/state-bridge';
import {
  allowedClaimCaseTransitions,
  claimResponseStatus,
  claimTransitionTarget,
  validateClaimCaseTransition,
} from '@/lib/workflow/claim-transition-policy';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { claims, claimUpdates, claimStatusEnum } from '@/db/schema/claims-schema';
import { inAppNotifications } from '@/db/schema';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { logger } from '@/lib/logger';
import { getCaseActor, findReadableCase, caseAuthorizationResponse } from '@/lib/cases/case-authorization';
import { loadClaimTransitionSource } from '@/lib/cases/claim-transition-source';
import { decideCaseCapabilitiesBatch } from '@/lib/authority/store/route-adapter';
import { authorizationDenialResponse } from '@/lib/api/authorization-denial';
import { inAppNoticeAllowed } from '@/lib/notifications/in-app-preferences';
import { memberCaseUrl } from '@/lib/notifications/links';
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

    const { reason } = parsed.data;
    const targetStatus = claimTransitionTarget(parsed.data.targetStatus);

    // 3. Load claim in RLS context (with row lock to prevent TOCTOU race)
    const result = await withRLSContext(async (tx) => {
      // The kernel decides this actor may transition this case; closing or reopening is a separate, narrower decision.
      const claim = await findReadableCase(tx, actor, caseId, true, 'case:transition');

      if (!claim) {
        return { found: false as const };
      }

      // 5. Validate FSM transition via canonical case-lifecycle.ts
      const cupeCurrentStatus = claimResponseStatus(claim.status);
      const currentLifecycleState = toLifecycleState('claim', claim.status);
      const targetLifecycleState = targetStatus && toLifecycleState('claim', targetStatus);

      if (!currentLifecycleState || !targetLifecycleState || !targetStatus) {
        return {
          found: true as const,
          allowed: false as const,
          reason: `Unknown or unsupported claim status: ${parsed.data.targetStatus}`,
          nextAllowedStatuses: [] as string[],
        };
      }

      if (targetLifecycleState === 'closed' || currentLifecycleState === 'closed') {
        const closer = await findReadableCase(tx, actor, caseId, true, 'case:close');
        if (!closer) return { found: false as const };
      }

      // The authorization projection deliberately has no narrative or clock
      // fields. Read these only after the kernel permits the action, inside
      // the same transaction that still holds the claim's row lock.
      const stored = await loadClaimTransitionSource(tx, orgId, claim.claimId);
      if (!stored) return { found: false as const };

      const validation = validateClaimCaseTransition(stored, actor.role, targetStatus, reason);

      if (!validation.allowed) {
        const powers = (await decideCaseCapabilitiesBatch(tx, {
          userId: actor.userId, organizationId: orgId, caseIds: [claim.claimId],
        })).get(claim.claimId);
        return {
          found: true as const,
          allowed: false as const,
          reason: validation.reason,
          nextAllowedStatuses: allowedClaimCaseTransitions(stored, actor.role, {
            canTransition: powers?.['case:transition'].effect === 'allow',
            canClose: powers?.['case:close'].effect === 'allow',
          }, reason)
            .map(claimResponseStatus),
        };
      }

      // 5. Apply transition
      const fromStatus = claim.status;
      const toDbStatus = targetStatus;

      const now = new Date();
      await tx
        .update(claims)
        .set({
          status: toDbStatus as typeof claimStatusEnum.enumValues[number],
          updatedAt: now,
          ...(targetStatus === 'closed' ? { closedAt: now } : {}),
          ...(targetStatus === 'resolved' || targetStatus === 'rejected'
            ? { resolvedAt: now }
            : {}),
        })
        .where(and(eq(claims.claimId, claim.claimId), eq(claims.organizationId, orgId)));

      // 6. Add transition note
      await tx.insert(claimUpdates).values({
        claimId: claimHistoryReference(claim.claimId),
        updateType: 'status_change',
        // The member-visible history contains only persisted states. The restricted
        // atomic audit below retains the reason and CUPE/FSM projections.
        message: `Status changed from '${fromStatus}' to '${toDbStatus}'`,
        createdBy: userId,
        isInternal: false,
        visibilityScope: 'member',
        metadata: {
          previousStatus: fromStatus,
          newStatus: toDbStatus,
        },
      });

      // The member is told in-app when their own case moves; the same transaction guarantees the
      // notice exists only if the transition committed.
      if (claim.memberId && claim.memberId !== userId && (await inAppNoticeAllowed(claim.memberId, actor.organizationId, 'case'))) {
        await tx.insert(inAppNotifications).values({
          userId: claim.memberId,
          organizationId: actor.organizationId,
          title: 'Your case status was updated',
          message: `Your case is now ${toDbStatus.replace(/_/g, ' ')}.`,
          type: 'info',
          actionLabel: 'View case',
          actionUrl: memberCaseUrl(claim.claimId),
          data: { event: 'case_status_changed', claimId: claim.claimId, toStatus: toDbStatus },
        });
      }

      // The transition, its history, the member's notice and its audit record commit together.
      await persistAtomicAudit(tx, {
        organizationId: orgId,
        userId,
        action: 'case.transition',
        resourceType: 'claims',
        resourceId: claim.claimId,
        details: {
          event: 'CASE_TRANSITIONED',
          from: fromStatus,
          to: toDbStatus,
          cupeFrom: cupeCurrentStatus,
          cupeTo: claimResponseStatus(targetStatus),
          reason: reason ?? null,
        },
      });

      return {
        found: true as const,
        allowed: true as const,
        fromStatus,
        toStatus: toDbStatus,
        cupeFromStatus: cupeCurrentStatus,
        cupeToStatus: claimResponseStatus(targetStatus),
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
      artifacts: [{ type: 'case_transition', data: { caseId: result.claimId, from: result.cupeFromStatus, to: result.cupeToStatus } }],
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
