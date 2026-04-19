import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  authenticateWithOrg,
  requirePermission,
  withRequestContext,
} from '@/lib/api-guards';
import { logAuditEvent } from '@/lib/audit-log';
import {
  createIncident,
  getDefaultOrgId,
  listIncidents,
} from '@/modules/incidents/service';
import type { IncidentCreateInput } from '@/modules/incidents/types';

function parseCreateBody(payload: unknown): IncidentCreateInput | null {
  if (!payload || typeof payload !== 'object') return null;

  const source = payload as Record<string, unknown>;
  const title = typeof source.title === 'string' ? source.title.trim() : '';
  const category = typeof source.category === 'string' ? source.category : '';
  const severity = typeof source.severity === 'string' ? source.severity : '';
  const intakeChannel =
    typeof source.intakeChannel === 'string' ? source.intakeChannel : '';
  const summary = typeof source.summary === 'string' ? source.summary.trim() : '';
  const dueAt = typeof source.dueAt === 'string' ? source.dueAt : null;

  if (!title || !summary) return null;
  if (!['hiring', 'promotion', 'discipline', 'service_delivery', 'policy'].includes(category)) {
    return null;
  }
  if (!['low', 'medium', 'high', 'critical'].includes(severity)) return null;
  if (!['web', 'email', 'phone', 'manager_escalation'].includes(intakeChannel)) {
    return null;
  }

  return {
    title,
    category: category as IncidentCreateInput['category'],
    severity: severity as IncidentCreateInput['severity'],
    intakeChannel: intakeChannel as IncidentCreateInput['intakeChannel'],
    summary,
    dueAt,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await authenticateWithOrg(request);
    if (!authz.ok) return authz.response;

    const permission = requirePermission(request, 'incident.read');
    if (!permission.ok) return permission.response;

    const incidents = await listIncidents(authz.orgId);

    logAuditEvent({
      action: 'incident.list',
      actorUserId: authz.userId,
      orgId: authz.orgId,
      entityType: 'incident',
      entityId: 'collection',
      details: { count: incidents.length, role: permission.role },
    });

    return NextResponse.json({
      orgId: authz.orgId,
      orgSource: authz.orgSource,
      dataSource: process.env.DATABASE_URL ? 'database' : 'seeded-memory',
      items: incidents,
    });
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await authenticateWithOrg(request);
    if (!authz.ok) return authz.response;

    const permission = requirePermission(request, 'incident.create');
    if (!permission.ok) return permission.response;

    const payload = parseCreateBody(await request.json().catch(() => null));
    if (!payload) {
      return NextResponse.json(
        {
          error: 'Invalid payload',
          code: 'INVALID_INCIDENT_PAYLOAD',
          required: ['title', 'category', 'severity', 'intakeChannel', 'summary'],
        },
        { status: 400 },
      );
    }

    const incident = await createIncident(authz.orgId || getDefaultOrgId(), authz.userId, payload);

    logAuditEvent({
      action: 'incident.create',
      actorUserId: authz.userId,
      orgId: authz.orgId,
      entityType: 'incident',
      entityId: incident.id,
      details: {
        status: incident.status,
        severity: incident.severity,
        role: permission.role,
      },
    });

    return NextResponse.json({
      orgId: authz.orgId,
      orgSource: authz.orgSource,
      dataSource: process.env.DATABASE_URL ? 'database' : 'seeded-memory',
      item: incident,
    });
  });
}
