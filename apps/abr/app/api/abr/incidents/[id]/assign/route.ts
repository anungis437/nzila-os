import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { logAuditEvent } from '@/lib/audit-log';
import {
  authenticateWithOrg,
  requirePermission,
  withRequestContext,
} from '@/lib/api-guards';
import { assignIncident } from '@/modules/incidents/service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await authenticateWithOrg(request);
    if (!authz.ok) return authz.response;

    const permission = requirePermission(request, 'incident.assign');
    if (!permission.ok) return permission.response;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const assignedTo = typeof body?.assignedTo === 'string' ? body.assignedTo : '';
    const reason = typeof body?.reason === 'string' ? body.reason : '';
    const dueAt = typeof body?.dueAt === 'string' ? body.dueAt : null;

    if (!assignedTo || !reason) {
      return NextResponse.json({ error: 'Invalid payload', code: 'INVALID_ASSIGNMENT_PAYLOAD' }, { status: 400 });
    }

    const { id } = await context.params;
    const updated = await assignIncident(authz.orgId, id, authz.userId, { assignedTo, reason, dueAt });
    if (!updated) {
      return NextResponse.json({ error: 'Not found', code: 'INCIDENT_NOT_FOUND' }, { status: 404 });
    }

    logAuditEvent({
      action: 'incident.assign',
      actorUserId: authz.userId,
      orgId: authz.orgId,
      entityType: 'incident',
      entityId: id,
      details: { role: permission.role, assignedTo },
    });

    return NextResponse.json({ item: updated });
  });
}
