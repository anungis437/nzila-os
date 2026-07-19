/**
 * CourtLens referral status mutation — Phase 2E.
 *
 * POST /api/courtlens/matters/[matterId]/referral-status
 *
 * - Requires authentication + verified org membership.
 * - Requires incident.update permission.
 * - Referral cannot be 'sent' before 'approved' — enforced by
 *   isValidReferralTransition in the courtlens FSM.
 * - Writes typed CourtLens event; state derived by event replay.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRequestContext, requireVerifiedOrgAccess, requireVerifiedPermission } from '@/lib/api-guards';
import { logAuditEvent } from '@/lib/audit-log';
import { updateReferralStatus } from '@/modules/incidents/matter-service';
import { REFERRAL_STATUSES, type ReferralStatus } from '@/modules/incidents/courtlens';

function isReferralStatus(v: unknown): v is ReferralStatus {
  return typeof v === 'string' && (REFERRAL_STATUSES as readonly string[]).includes(v);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ matterId: string }> },
): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await requireVerifiedOrgAccess(request);
    if (!authz.ok) return authz.response;

    const permission = requireVerifiedPermission(authz.context, 'incident.update');
    if (!permission.ok) return permission.response;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json(
        { error: 'Request body must be valid JSON', code: 'INVALID_JSON' },
        { status: 400 },
      );
    }

    const from = body.from;
    const to = body.to;
    if (!isReferralStatus(from) || !isReferralStatus(to)) {
      return NextResponse.json(
        {
          error: 'from and to must be valid referral status values',
          code: 'INVALID_REFERRAL_STATUS',
          allowed: REFERRAL_STATUSES,
        },
        { status: 400 },
      );
    }

    const { matterId } = await context.params;

    const result = await updateReferralStatus(
      authz.context.orgId,
      matterId,
      authz.context.userId,
      from,
      to,
    );

    if (!result.success) {
      const isNotFound = result.reason === 'Matter not found';
      return NextResponse.json(
        {
          error: result.reason,
          code: isNotFound ? 'MATTER_NOT_FOUND' : 'REFERRAL_TRANSITION_REJECTED',
        },
        { status: isNotFound ? 404 : 400 },
      );
    }

    await logAuditEvent({
      action: 'courtlens.matter.referral_status.updated',
      actorUserId: authz.context.userId,
      orgId: authz.context.orgId,
      entityType: 'matter',
      details: {
        matterId,
        from,
        to,
        role: authz.context.role,
        membershipSource: authz.context.membershipSource,
      },
    });

    return NextResponse.json({ ok: true, matterId, to: result.to });
  });
}
