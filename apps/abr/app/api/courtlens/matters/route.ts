/**
 * CourtLens tenant matter queue API — Phase 2C.
 *
 * GET /api/courtlens/matters
 *
 * - Requires authentication (ABR platform-auth session).
 * - Requires valid org context (x-org-id header).
 * - Enforces incident.read permission.
 * - Returns queue-safe operational summaries only; no client profile, raw
 *   events, reviewer notes, AI packet content, or internal audit data.
 * - CourtLens state (practiceArea, subIssue, aiSummaryStatus, referralStatus)
 *   derived from incident event replay per item.
 *
 * Phase 2C performance note: queue uses per-item event replay (N+1). Acceptable
 * for pilot-scale queues. See listMatterQueueForOrg JSDoc for migration path.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRequestContext, requireVerifiedOrgAccess, requireVerifiedPermission } from '@/lib/api-guards';
import { logAuditEvent } from '@/lib/audit-log';
import { listMatterQueueForOrg } from '@/modules/incidents/matter-service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await requireVerifiedOrgAccess(request);
    if (!authz.ok) return authz.response;

    const permission = requireVerifiedPermission(authz.context, 'incident.read');
    if (!permission.ok) return permission.response;

    const items = await listMatterQueueForOrg(authz.context.orgId);

    logAuditEvent({
      action: 'courtlens.matter_queue.listed',
      actorUserId: authz.context.userId,
      orgId: authz.context.orgId,
      entityType: 'matter',
      details: {
        count: items.length,
        role: authz.context.role,
        membershipSource: authz.context.membershipSource,
      },
    });

    return NextResponse.json({
      orgId: authz.context.orgId,
      dataSource: process.env.DATABASE_URL ? 'database' : 'seeded-memory',
      items,
    });
  });
}
