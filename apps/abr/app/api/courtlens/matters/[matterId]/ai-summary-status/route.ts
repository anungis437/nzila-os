/**
 * CourtLens AI review packet status mutation — Phase 2E.
 *
 * POST /api/courtlens/matters/[matterId]/ai-summary-status
 *
 * - Requires authentication (platform-auth session).
 * - Requires verified org membership (Phase 2C.6 trusted guards).
 * - Requires incident.update permission.
 * - Human-only approval enforcement lives in updateAiSummaryStatus service.
 * - Writes typed CourtLens event; state derived by event replay.
 * - Never exposes raw event payloads in response.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRequestContext, requireVerifiedOrgAccess, requireVerifiedPermission } from '@/lib/api-guards';
import { logAuditEvent } from '@/lib/audit-log';
import { updateAiSummaryStatus } from '@/modules/incidents/matter-service';
import { AI_SUMMARY_STATUSES, type AiSummaryStatus } from '@/modules/incidents/courtlens';

function isAiSummaryStatus(v: unknown): v is AiSummaryStatus {
  return typeof v === 'string' && (AI_SUMMARY_STATUSES as readonly string[]).includes(v);
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
    if (!isAiSummaryStatus(from) || !isAiSummaryStatus(to)) {
      return NextResponse.json(
        {
          error: 'from and to must be valid AI summary status values',
          code: 'INVALID_AI_SUMMARY_STATUS',
          allowed: AI_SUMMARY_STATUSES,
        },
        { status: 400 },
      );
    }

    const { matterId } = await context.params;

    // Server-enforced: actorType is always 'human' when a real user is authenticated.
    // The updateAiSummaryStatus service enforces human-only approval for
    // 'approved' and 'revised_by_human' targets. AI system callers must use a
    // separate service path (not exposed to public HTTP).
    const result = await updateAiSummaryStatus(
      authz.context.orgId,
      matterId,
      authz.context.userId,
      from,
      to,
      'human',
    );

    if (!result.success) {
      const isNotFound = result.reason === 'Matter not found';
      return NextResponse.json(
        {
          error: result.reason,
          code: isNotFound ? 'MATTER_NOT_FOUND' : 'AI_SUMMARY_TRANSITION_REJECTED',
        },
        { status: isNotFound ? 404 : 400 },
      );
    }

    await logAuditEvent({
      action: 'courtlens.matter.ai_summary_status.updated',
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
