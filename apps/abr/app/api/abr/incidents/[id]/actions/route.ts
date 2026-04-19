import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { logAuditEvent } from '@/lib/audit-log';
import {
  requireOrgAccess,
  requirePermission,
  withRequestContext,
} from '@/lib/api-guards';
import { addIncidentAction } from '@/modules/incidents/service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await requireOrgAccess(request);
    if (!authz.ok) return authz.response;

    const permission = requirePermission(request, 'incident.actions.manage');
    if (!permission.ok) return permission.response;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const ownerId = typeof body?.ownerId === 'string' ? body.ownerId : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const remediationType = typeof body?.remediationType === 'string' ? body.remediationType : '';
    const dueDate = typeof body?.dueDate === 'string' ? body.dueDate : '';

    if (!ownerId || !description || !dueDate) {
      return NextResponse.json({ error: 'Invalid payload', code: 'INVALID_ACTION_PAYLOAD' }, { status: 400 });
    }

    if (![
      'policy_review',
      'training_assignment',
      'leadership_meeting',
      'process_correction',
      'communication_plan',
      'disciplinary_review',
      'external_advisor_consult',
    ].includes(remediationType)) {
      return NextResponse.json({ error: 'Invalid remediation type', code: 'INVALID_REMEDIATION_TYPE' }, { status: 400 });
    }

    const { id } = await context.params;
    const action = await addIncidentAction(authz.orgId, id, authz.userId, {
      ownerId,
      description,
      remediationType: remediationType as never,
      dueDate,
    });

    if (!action) {
      return NextResponse.json({ error: 'Not found', code: 'INCIDENT_NOT_FOUND' }, { status: 404 });
    }

    logAuditEvent({
      action: 'incident.action.create',
      actorUserId: authz.userId,
      orgId: authz.orgId,
      entityType: 'incident',
      details: { role: permission.role, actionId: action.id, incidentId: id },
    });

    return NextResponse.json({ item: action });
  });
}
