import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { logAuditEvent } from '@/lib/audit-log';
import {
  authenticateWithOrg,
  requirePermission,
  withRequestContext,
} from '@/lib/api-guards';
import {
  addIncidentNote,
  getIncidentDetail,
  updateIncident,
} from '@/modules/incidents/service';
import type { IncidentUpdateInput } from '@/modules/incidents/types';

function parsePatch(payload: unknown): {
  update: IncidentUpdateInput;
  note?: {
    visibilityScope: 'private' | 'investigator_only' | 'legal_only' | 'executive_safe';
    content: string;
  };
} | null {
  if (!payload || typeof payload !== 'object') return null;
  const source = payload as Record<string, unknown>;

  const update: IncidentUpdateInput = {};

  if (typeof source.title === 'string') update.title = source.title.trim();
  if (typeof source.summary === 'string') update.summary = source.summary.trim();
  if (typeof source.category === 'string') {
    if (!['hiring', 'promotion', 'discipline', 'service_delivery', 'policy'].includes(source.category)) {
      return null;
    }
    update.category = source.category as IncidentUpdateInput['category'];
  }
  if (typeof source.severity === 'string') {
    if (!['low', 'medium', 'high', 'critical'].includes(source.severity)) return null;
    update.severity = source.severity as IncidentUpdateInput['severity'];
  }
  if (typeof source.dueAt === 'string' || source.dueAt === null) {
    update.dueAt = source.dueAt as string | null;
  }

  const noteContent = typeof source.noteContent === 'string' ? source.noteContent.trim() : '';
  const noteScope = typeof source.noteScope === 'string' ? source.noteScope : 'private';
  const note = noteContent
    ? {
        content: noteContent,
        visibilityScope: (['private', 'investigator_only', 'legal_only', 'executive_safe'].includes(noteScope)
          ? noteScope
          : 'private') as 'private' | 'investigator_only' | 'legal_only' | 'executive_safe',
      }
    : undefined;

  return { update, note };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await authenticateWithOrg(request);
    if (!authz.ok) return authz.response;

    const permission = requirePermission(request, 'incident.read');
    if (!permission.ok) return permission.response;

    const { id } = await context.params;
    const includeSensitiveNotes = permission.role !== 'executive_viewer' && permission.role !== 'auditor';
    const detail = await getIncidentDetail(authz.orgId, id, includeSensitiveNotes);
    if (!detail) {
      return NextResponse.json({ error: 'Not found', code: 'INCIDENT_NOT_FOUND' }, { status: 404 });
    }

    logAuditEvent({
      action: 'incident.get',
      actorUserId: authz.userId,
      orgId: authz.orgId,
      entityType: 'incident',
      entityId: id,
      details: { role: permission.role },
    });

    return NextResponse.json({ item: detail });
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await authenticateWithOrg(request);
    if (!authz.ok) return authz.response;

    const permission = requirePermission(request, 'incident.update');
    if (!permission.ok) return permission.response;

    const parsed = parsePatch(await request.json().catch(() => null));
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid payload', code: 'INVALID_PATCH_PAYLOAD' }, { status: 400 });
    }

    const { id } = await context.params;
    const updated = await updateIncident(authz.orgId, id, authz.userId, parsed.update);
    if (!updated) {
      return NextResponse.json({ error: 'Not found', code: 'INCIDENT_NOT_FOUND' }, { status: 404 });
    }

    if (parsed.note) {
      await addIncidentNote(authz.orgId, id, authz.userId, parsed.note.visibilityScope, parsed.note.content);
    }

    logAuditEvent({
      action: 'incident.patch',
      actorUserId: authz.userId,
      orgId: authz.orgId,
      entityType: 'incident',
      entityId: id,
      details: { role: permission.role },
    });

    return NextResponse.json({ item: updated });
  });
}
