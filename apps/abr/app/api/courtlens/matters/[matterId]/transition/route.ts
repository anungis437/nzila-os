/**
 * CourtLens matter status transition — Phase 2E.
 *
 * POST /api/courtlens/matters/[matterId]/transition
 *
 * - Requires authentication + verified org membership.
 * - Requires incident.transition permission.
 * - Reuses the existing ABR incident FSM via transitionMatterStatus →
 *   transitionIncident → assertValidTransition.
 * - CourtLens vocabulary (status label) is display-only; ABR FSM is authoritative.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRequestContext, requireVerifiedOrgAccess, requireVerifiedPermission } from '@/lib/api-guards';
import { logAuditEvent } from '@/lib/audit-log';
import { transitionMatterStatus } from '@/modules/incidents/matter-service';
import type { IncidentStatus } from '@/modules/incidents/types';

const VALID_STATUSES: readonly IncidentStatus[] = [
  'new', 'triage', 'assigned', 'investigating', 'action_planning',
  'monitoring', 'resolved', 'closed', 'archived',
];

function isIncidentStatus(v: unknown): v is IncidentStatus {
  return typeof v === 'string' && (VALID_STATUSES as readonly string[]).includes(v);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ matterId: string }> },
): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await requireVerifiedOrgAccess(request);
    if (!authz.ok) return authz.response;

    const permission = requireVerifiedPermission(authz.context, 'incident.transition');
    if (!permission.ok) return permission.response;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json(
        { error: 'Request body must be valid JSON', code: 'INVALID_JSON' },
        { status: 400 },
      );
    }

    const to = body.to;
    const reason = typeof body.reason === 'string' ? body.reason : '';

    if (!isIncidentStatus(to)) {
      return NextResponse.json(
        {
          error: 'to must be a valid matter status',
          code: 'INVALID_MATTER_STATUS',
          allowed: VALID_STATUSES,
        },
        { status: 400 },
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: 'reason is required for a matter status transition', code: 'REASON_REQUIRED' },
        { status: 400 },
      );
    }

    const { matterId } = await context.params;

    try {
      const updated = await transitionMatterStatus(
        authz.context.orgId,
        matterId,
        authz.context.userId,
        { to, reason },
      );

      if (!updated) {
        return NextResponse.json(
          { error: 'Matter not found', code: 'MATTER_NOT_FOUND' },
          { status: 404 },
        );
      }

      logAuditEvent({
        action: 'courtlens.matter.transition',
        actorUserId: authz.context.userId,
        orgId: authz.context.orgId,
        entityType: 'matter',
        details: {
          matterId,
          to,
          role: authz.context.role,
          membershipSource: authz.context.membershipSource,
        },
      });

      return NextResponse.json({ ok: true, matterId, to });
    } catch (error) {
      // Existing ABR FSM throws on invalid transitions
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Transition failed',
          code: 'INVALID_MATTER_TRANSITION',
        },
        { status: 400 },
      );
    }
  });
}
