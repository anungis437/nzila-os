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
import { withRequestContext, requireOrgAccess, requirePermission } from '@/lib/api-guards';
import { logAuditEvent } from '@/lib/audit-log';
import { listMatterQueueForOrg } from '@/modules/incidents/matter-service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await requireOrgAccess(request);
    if (!authz.ok) return authz.response;

    const permission = requirePermission(request, 'incident.read');
    if (!permission.ok) return permission.response;

    const items = await listMatterQueueForOrg(authz.orgId);

    logAuditEvent({
      action: 'courtlens.matter_queue.listed',
      actorUserId: authz.userId,
      orgId: authz.orgId,
      entityType: 'matter',
      details: { count: items.length, role: permission.role },
    });

    return NextResponse.json({
      orgId: authz.orgId,
      dataSource: process.env.DATABASE_URL ? 'database' : 'seeded-memory',
      items,
    });
  });
}
