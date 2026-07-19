import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { logAuditEvent } from '@/lib/audit-log';
import {
  requireOrgAccess,
  requirePermission,
  withRequestContext,
} from '@/lib/api-guards';
import { transitionIncident } from '@/modules/incidents/service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await requireOrgAccess(request);
    if (!authz.ok) return authz.response;

    const permission = requirePermission(request, 'incident.transition');
    if (!permission.ok) return permission.response;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const to = typeof body?.to === 'string' ? body.to : '';
    const reason = typeof body?.reason === 'string' ? body.reason : '';

    if (!to || !reason) {
      return NextResponse.json({ error: 'Invalid payload', code: 'INVALID_TRANSITION_PAYLOAD' }, { status: 400 });
    }

    const { id } = await context.params;

    try {
      const updated = await transitionIncident(authz.orgId, id, authz.userId, {
        to: to as never,
        reason,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Not found', code: 'INCIDENT_NOT_FOUND' }, { status: 404 });
      }

      await logAuditEvent({
        action: 'incident.transition',
        actorUserId: authz.userId,
        orgId: authz.orgId,
        entityType: 'incident',
        details: { role: permission.role, to, incidentId: id },
      });

      return NextResponse.json({ item: updated });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Transition failed',
          code: 'INVALID_STATE_TRANSITION',
        },
        { status: 400 },
      );
    }
  });
}
