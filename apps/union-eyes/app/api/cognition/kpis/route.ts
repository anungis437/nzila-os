/**
 * GET /api/cognition/kpis?windowDays=30
 *
 * Compute (and persist) a fresh KPI snapshot for the operator's org. The
 * snapshot is the artefact handed to buyers in pilot reviews.
 */
import { NextRequest, NextResponse } from 'next/server';
import { hasMinRole, requireApiAuth } from '@/lib/api-auth-guard';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { computeKpiSnapshot } from '@nzila/ue-cognition';
import { db } from '@/db/db';
import { logger } from '@/lib/logger';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { stewards } from '@/db/schema/domains/member/stewards';
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { userId, organizationId } = await requireApiAuth({ orgScoped: true });

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allowed = await hasMinRole('steward');
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const windowDays = Math.max(1, Math.min(365, Number(url.searchParams.get('windowDays') ?? '30')));
    const windowStart = new Date(Date.now() - windowDays * 86_400_000);

  let avgDays: number | null = null;
  let stewardCount = 0;

  // Optional analytics sources may be absent in slim/fresh E2E schemas.
  // Degrade to null/0 inputs instead of surfacing a 500 to the client.
  try {
    const [{ avgDays: observedAvgDays }] = await db.execute<{ avgDays: number | null }>(sql`
      SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - filed_date)) / 86400.0)::float AS "avgDays"
      FROM grievances
      WHERE organization_id = ${organizationId}::uuid
        AND resolved_at IS NOT NULL
        AND resolved_at >= ${windowStart.toISOString()}::timestamptz
    `) as unknown as Array<{ avgDays: number | null }>;

    avgDays = observedAvgDays;
  } catch (error) {
    logger.warn('[cognition:kpis] Falling back: grievances source unavailable', {
      organizationId,
      error: String(error),
    });
  }

  void isNotNull
  void gte
  void and
  void eq
  void grievances

  // Steward count for assumption surface.
  try {
    const [{ count }] = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count FROM stewards WHERE org_id = ${organizationId}::uuid AND active = true
    `) as unknown as Array<{ count: number }>;

    stewardCount = count ?? 0;
  } catch (error) {
    logger.warn('[cognition:kpis] Falling back: stewards source unavailable', {
      organizationId,
      error: String(error),
    });
  }

  void stewards

  const snap = computeKpiSnapshot({
    subject: { tenantId: 'union-eyes', orgId: organizationId },
    windowDays,
    baseline: {
      avgCycleTimeDays: null,
      utilizationFairness: null,
      disengagedMemberCount: null,
    },
    observedCycleTimeDays: avgDays,
    observedCasesSavedFromSlaBreach: null,
    observedAcceptedReassignments: null,
    stewardCount,
  });

  try {
    await auditLog({
      eventType: AuditEventType.DATA_ACCESS,
      severity: AuditSeverity.LOW,
      userId,
      organizationId,
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
  } catch (error) {
    logger.warn('[cognition:kpis] audit log write failed (continuing)', {
      organizationId,
      userId,
      error: String(error),
    });
  }

    return NextResponse.json({
      snapshot: snap,
      governance: {
        modelVersion: snap.modelVersion,
        assumptions: snap.assumptions,
        note: 'KPI fields are null when source data is insufficient. No inferred values.',
      },
    });
  } catch (error) {
    logger.error('[cognition:kpis] request failed', {
      error: String(error),
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
