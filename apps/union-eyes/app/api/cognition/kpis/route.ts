/**
 * GET /api/cognition/kpis?windowDays=30
 *
 * Compute (and persist) a fresh KPI snapshot for the operator's org. The
 * snapshot is the artefact handed to buyers in pilot reviews.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { hasMinRole } from '@/lib/api-auth-guard';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { computeKpiSnapshot } from '@nzila/ue-cognition';
import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { stewards } from '@/db/schema/domains/member/stewards';
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';

export const GET = withOrganizationAuth(async (
  request: NextRequest,
  context,
) => {
  const allowed = await hasMinRole('steward');
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const windowDays = Math.max(1, Math.min(365, Number(url.searchParams.get('windowDays') ?? '30')));
  const windowStart = new Date(Date.now() - windowDays * 86_400_000);

  // Real observed cycle time (days) over window: avg(resolvedAt - filedDate).
  const [{ avgDays }] = await db.execute<{ avgDays: number | null }>(sql`
    SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - filed_date)) / 86400.0)::float AS "avgDays"
    FROM grievances
    WHERE organization_id = ${context.organizationId}::uuid
      AND resolved_at IS NOT NULL
      AND resolved_at >= ${windowStart.toISOString()}::timestamptz
  `) as unknown as Array<{ avgDays: number | null }>;
  void isNotNull
  void gte
  void and
  void eq
  void grievances

  // Steward count for assumption surface.
  const [{ count: stewardCount }] = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM stewards WHERE org_id = ${context.organizationId}::uuid AND active = true
  `) as unknown as Array<{ count: number }>;
  void stewards

  const snap = computeKpiSnapshot({
    subject: { tenantId: 'union-eyes', orgId: context.organizationId },
    windowDays,
    baseline: {
      avgCycleTimeDays: null,
      utilizationFairness: null,
      disengagedMemberCount: null,
    },
    observedCycleTimeDays: avgDays,
    observedCasesSavedFromSlaBreach: null,
    observedAcceptedReassignments: null,
    stewardCount: stewardCount ?? 0,
  });

  await auditLog({
    eventType: AuditEventType.DATA_ACCESS,
    severity: AuditSeverity.LOW,
    userId: context.userId,
    organizationId: context.organizationId,
    resource: 'cognition_kpi',
    resourceId: snap.id,
    action: 'compute',
    details: {
      windowDays,
      adminHoursSaved: snap.estimatedAdminHoursSaved,
      roiCad: snap.estimatedRoiCad,
    },
    outcome: 'success',
  });

  return NextResponse.json({
    snapshot: snap,
    governance: {
      modelVersion: snap.modelVersion,
      assumptions: snap.assumptions,
      note: 'KPI fields are null when source data is insufficient. No inferred values.',
    },
  });
});
