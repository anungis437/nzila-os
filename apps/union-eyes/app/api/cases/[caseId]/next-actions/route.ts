/**
 * Case Next Actions API — GET /api/cases/[caseId]/next-actions
 *
 * Returns the set of allowed status transitions for the authenticated user.
 * Used by the UI to show/hide action buttons.
 *
 * PR-022: FSM Enforcement + Transition Tests
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getAllowedTransitions } from '@/lib/case-fsm-enforcement';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { db } from '@/db/db';
import { claims } from '@/db/schema/claims-schema';
import { logger } from '@/lib/logger';
import { getUserRoleInOrganization } from '@/lib/organization-utils';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params;

    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED', message: 'Authentication required.' },
        { status: 401 },
      );
    }
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

    // Map DB status to CUPE vocabulary
    const cupeStatus = mapDbStatusToCupe(claim.status);

    // Resolve actor role from org membership
    const resolvedRole = await getUserRoleInOrganization(userId, orgId);
    const actorRole = resolvedRole ?? 'member';

    const transitions = getAllowedTransitions(cupeStatus, actorRole);

    return NextResponse.json({
      caseId,
      currentStatus: cupeStatus,
      allowedTransitions: transitions,
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
