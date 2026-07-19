/**
 * CourtLens tenant matter detail API — Phase 2C.
 *
 * GET /api/courtlens/matters/[matterId]
 *
 * - Requires authentication (ABR platform-auth session).
 * - Requires valid org context (x-org-id header).
 * - Enforces incident.read permission.
 * - Enforces org-scoped access: matterId must belong to the authenticated org.
 * - Applies role-aware redaction via existing ABR visibility patterns.
 * - Sensitive CourtLens fields (riskFlags, clientProfile, clientGoal, hearingDate,
 *   deadlineDate) are null for roles without evidence access.
 * - Never exposes raw event payloads or complete client PII.
 * - Legal boundary notice is mandatory on every response.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRequestContext, requireVerifiedOrgAccess, requireVerifiedPermission } from '@/lib/api-guards';
import { logAuditEvent } from '@/lib/audit-log';
import { getMatterDetail, buildMatterDetailView } from '@/modules/incidents/matter-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matterId: string }> },
): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await requireVerifiedOrgAccess(request);
    if (!authz.ok) return authz.response;

    const permission = requireVerifiedPermission(authz.context, 'incident.read');
    if (!permission.ok) return permission.response;

    const { matterId } = await params;
    if (!matterId || typeof matterId !== 'string') {
      return NextResponse.json(
        { error: 'Missing matter ID', code: 'MISSING_MATTER_ID' },
        { status: 400 },
      );
    }

    // Org-scoped lookup — returns null if matterId does not belong to this org.
    const result = await getMatterDetail(authz.context.orgId, matterId, {
      role: authz.context.role,
      includeSensitiveNotes: true,
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Matter not found', code: 'MATTER_NOT_FOUND' },
        { status: 404 },
      );
    }

    const view = buildMatterDetailView(result.matter, result.detail!, authz.context.role);

    await logAuditEvent({
      action: 'courtlens.matter.viewed',
      actorUserId: authz.context.userId,
      orgId: authz.context.orgId,
      entityType: 'matter',
      details: {
        matterId,
        role: authz.context.role,
        membershipSource: authz.context.membershipSource,
      },
    });

    return NextResponse.json({
      orgId: authz.context.orgId,
      matter: view,
    });
  });
}
