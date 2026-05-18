/**
 * Case Next Actions API — GET /api/cases/[caseId]/next-actions
 *
 * Returns the set of allowed status transitions for the authenticated user.
 * Used by the UI to show/hide action buttons.
 *
 * PR-022: FSM Enforcement + Transition Tests
 */

import { NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { eq } from 'drizzle-orm';
import { getAllowedTransitions, type ActorRole } from '@/lib/workflow/case-lifecycle';
import { toLifecycleState, toLegacyClaimStatus } from '@/lib/workflow/state-bridge';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { claims } from '@/db/schema/claims-schema';
import { logger } from '@/lib/logger';
import { getOrganizationIdForUser, getUserRoleInOrganization } from '@/lib/organization-utils';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params;

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED', message: 'Authentication required.' },
        { status: 401 },
      );
    }
    const orgId = await getOrganizationIdForUser(userId);
    await requireEntitlement(orgId, 'grievance_case_suite');

    const claim = await withRLSContext(async (tx) => {
      const [row] = await tx
        .select({ status: claims.status })
        .from(claims)
        .where(eq(claims.claimId, caseId))
        .limit(1);
      return row ?? null;
    });

    if (!claim) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Case '${caseId}' not found.` },
        { status: 404 },
      );
    }

    // Map DB status to canonical LifecycleState, then get allowed transitions
    const lifecycleState = toLifecycleState('claim', claim.status) ?? 'submitted';

    // Resolve actor role from org membership
    const resolvedRole = await getUserRoleInOrganization(userId, orgId);
    const actorRole = normalizeActorRole(resolvedRole);

    const allowedLifecycle = getAllowedTransitions(lifecycleState, actorRole);
    // Convert back to legacy ClaimStatus values for backward-compat consumers
    const allowedTransitions = [...new Set(allowedLifecycle.map(toLegacyClaimStatus))];

    return NextResponse.json({
      caseId,
      currentStatus: claim.status,
      currentLifecycleState: lifecycleState,
      allowedTransitions,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    logger.error('Failed to get next actions', error as Error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}

function normalizeActorRole(role: string | null | undefined): ActorRole {
  const map: Record<string, ActorRole> = {
    platform_admin: 'system_admin',
    system_admin: 'system_admin',
    admin: 'admin',
    union_admin: 'admin',
    officer: 'officer',
    chief_steward: 'chief_steward',
    business_agent: 'chief_steward',
    steward: 'steward',
    union_staff: 'steward',
    member: 'member',
  };
  return map[role ?? ''] ?? 'member';
}
