import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  requireOrgAccess,
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
import { enforceDecision } from '@nzila/decision-core';
import { createNarProofAdapter, getNarSigningSecret } from '@nzila/nar';
import { platformDb } from '@nzila/db/platform';
import { auditRecords } from '@nzila/db/schema';
import { desc, eq } from 'drizzle-orm';

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
    const authz = await requireOrgAccess(request);
    if (!authz.ok) return authz.response;

    const permission = requirePermission(request, 'incident.read');
    if (!permission.ok) return permission.response;

    const incidents = await listIncidents(authz.orgId);

    await logAuditEvent({
      action: 'incident.list',
      actorUserId: authz.userId,
      orgId: authz.orgId,
      entityType: 'incident',
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

const narProofAdapter = createNarProofAdapter({
  keyId: process.env.NAR_SIGNING_KEY_ID,
  getPreviousHash: async (organizationId) => {
    const rows = await platformDb
      .select({ hash: auditRecords.narHash })
      .from(auditRecords)
      .where(eq(auditRecords.organizationId, organizationId))
      .orderBy(desc(auditRecords.createdAt))
      .limit(1);
    return rows[0]?.hash;
  },
  persistRecord: async (record) => {
    await platformDb.insert(auditRecords).values({
      id: record.id,
      decisionRecordId: record.decisionRecordId,
      organizationId: record.organizationId,
      decisionType: record.decisionType,
      actionType: record.actionType,
      actorId: record.actorId,
      actorType: record.actorType,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      policyId: record.policyId,
      policyVersion: record.policyVersion,
      inputHash: record.inputHash,
      outcomeHash: record.outcomeHash,
      payload: record.payload,
      narHash: record.seal.hash,
      narSignature: record.seal.signature,
      previousHash: record.seal.previousHash,
      keyId: record.seal.keyId,
      storageType: record.storage?.type,
      storageUri: record.storage?.uri,
      immutable: record.storage?.immutable,
      retentionUntil: record.storage?.retentionUntil ? new Date(record.storage.retentionUntil) : null,
      createdAt: new Date(record.createdAt),
    });
    return { auditRecordId: record.id };
  },
  getSigningSecret: getNarSigningSecret,
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await requireOrgAccess(request);
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

    const preflightDecision = await enforceDecision({
      decisionType: 'faircase.case.classified',
      organizationId: authz.orgId,
      resourceId: 'pending',
      actor: {
        id: authz.userId,
        type: 'user',
        role: permission.role,
        authorityScope: ['case:classify'],
      },
      authorityScope: ['case:classify'],
      input: {
        caseId: 'pending',
        classification: payload.category,
      },
      policy: {
        id: 'legal.case.classification',
        version: '1.0.0',
        domain: 'legal',
      },
      actionType: 'case:classify',
      proofAdapter: narProofAdapter,
      emitAuditPayload: true,
    });

    if (!preflightDecision.allowed) {
      return NextResponse.json(
        { error: 'Decision validation failed', code: 'DECISION_VALIDATION_FAILED', decision: preflightDecision.decision },
        { status: 422 },
      );
    }

    const incident = await createIncident(authz.orgId || getDefaultOrgId(), authz.userId, payload);

    const recordedDecision = await enforceDecision({
      decisionType: 'faircase.case.classified',
      organizationId: authz.orgId,
      resourceId: incident.id,
      actor: {
        id: authz.userId,
        type: 'user',
        role: permission.role,
        authorityScope: ['case:classify'],
      },
      authorityScope: ['case:classify'],
      input: {
        caseId: incident.id,
        classification: payload.category,
      },
      policy: {
        id: 'legal.case.classification',
        version: '1.0.0',
        domain: 'legal',
      },
      actionType: 'case:classify',
      proofAdapter: narProofAdapter,
      emitAuditPayload: true,
    });

    await logAuditEvent({
      action: 'incident.create',
      actorUserId: authz.userId,
      orgId: authz.orgId,
      entityType: 'incident',
      details: {
        incidentId: incident.id,
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
      decision: recordedDecision.decision,
    });
  });
}
