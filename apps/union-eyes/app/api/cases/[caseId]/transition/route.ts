/**
 * Case Status Transition API — PATCH /api/cases/[caseId]/transition
 *
 * Server-side enforced status transitions using CUPE vocabulary FSM rules.
 * All transitions are validated, logged, and audited.
 *
 * PR-022: FSM Enforcement + Transition Tests
 */

import { NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
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
import { auditDataMutation } from '@/lib/audit-logger';
import { logger } from '@/lib/logger';
import { getOrganizationIdForUser, getUserRoleInOrganization } from '@/lib/organization-utils';
import { wrapSchemaQuery } from '@/lib/schema-error';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { buildUnionEvidencePack } from '@/lib/evidence';

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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED', message: 'Authentication required.' },
        { status: 401 },
      );
    }
    const orgId = await getOrganizationIdForUser(userId);
    await requireEntitlement(orgId, 'grievance_case_suite');

    // 2. Parse + validate body
    let body: unknown;
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
      const [claim] = await wrapSchemaQuery(
        async () => await tx
          .select({
            claimId: claims.claimId,
            status: claims.status,
            priority: claims.priority,
            organizationId: claims.organizationId,
            assignedTo: claims.assignedTo,
          })
          .from(claims)
          .where(eq(claims.claimId, caseId))
          .limit(1)
          .for('update'),
        { table: 'claims', route: '/api/cases/[caseId]/transition', query: 'SELECT FOR UPDATE' }
      );

      if (!claim) {
        return { found: false as const };
      }

      // 4. Resolve actor role from org membership
      const resolvedRole = await getUserRoleInOrganization(userId, claim.organizationId);
      const actorRole = resolvedRole ?? 'member';

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

      const normalizedRole = normalizeActorRole(actorRole);
      const validation = validateTransition({
        caseId,
        currentState: currentLifecycleState,
        targetState: targetLifecycleState,
        actorRole: normalizedRole,
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
        .where(eq(claims.claimId, caseId));

      // 6. Add transition note
      await tx.insert(claimUpdates).values({
        claimId: caseId,
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
        claimId: caseId,
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
      resourceId: caseId,
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
      claimId: caseId,
      from: result.fromStatus,
      to: result.toStatus,
    });

    // Evidence: case status transition audit trail
    buildUnionEvidencePack({
      actionType: 'CASE_TRANSITIONED',
      orgId: orgId,
      actorId: userId,
      artifacts: [{ type: 'case_transition', data: { caseId, from: result.cupeFromStatus, to: result.cupeToStatus, reason } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'CASE_TRANSITIONED' }))

    return NextResponse.json({
      success: true,
      claimId: caseId,
      fromStatus: result.cupeFromStatus,
      toStatus: result.cupeToStatus,
    });
  } catch (error) {
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
