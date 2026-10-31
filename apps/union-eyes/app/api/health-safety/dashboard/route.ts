/**
 * GET /api/health-safety/dashboard
 * Dashboard aggregation for the HealthSafetyDashboard component.
 * Returns { success: true, metrics: SafetyMetrics }.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

function getStartDate(period: string): string {
  const now = new Date();
  switch (period) {
    case '7d': return new Date(now.getTime() - 7 * 86_400_000).toISOString();
    case '30d': return new Date(now.getTime() - 30 * 86_400_000).toISOString();
    case '90d': return new Date(now.getTime() - 90 * 86_400_000).toISOString();
    case '12m': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();
    default: return new Date(now.getTime() - 30 * 86_400_000).toISOString();
  }
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Health-safety'],
      summary: 'Health & Safety dashboard metrics',
    },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '30d';
    const startDate = getStartDate(period);
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const orgFilter = sql`organization_id = ${organizationId}`;
    const dateFilter = sql`created_at >= ${startDate}::timestamptz`;

    try {
    return await withRLSContext({ organizationId }, async (tx) => {
    const incidentRows = Array.from(
        await tx.execute(sql`SELECT count(*)::int AS cnt FROM workplace_incidents WHERE ${orgFilter} AND status <> 'archived' AND ${dateFilter}`)
      );
      const totalIncidents = Number((incidentRows[0] as Record<string, unknown>)?.cnt ?? 0);

      const startMs = new Date(startDate).getTime();
      const prevStart = new Date(startMs - (Date.now() - startMs)).toISOString();
      const prevRows = Array.from(
        await tx.execute(sql`SELECT count(*)::int AS cnt FROM workplace_incidents WHERE ${orgFilter} AND status <> 'archived' AND created_at >= ${prevStart}::timestamptz AND created_at < ${startDate}::timestamptz`)
      );
      const prevIncidents = Number((prevRows[0] as Record<string, unknown>)?.cnt ?? 0);
      const incidentChange = prevIncidents > 0
        ? Math.round(((totalIncidents - prevIncidents) / prevIncidents) * 100)
        : 0;
      const incidentTrend = incidentChange > 0 ? 'up' : incidentChange < 0 ? 'down' : 'stable';

      const hazardRows = Array.from(
        await tx.execute(sql`SELECT count(*)::int AS cnt FROM hazard_reports WHERE ${orgFilter} AND (status IS NULL OR status NOT IN ('resolved','closed','archived'))`)
      );
      const openHazards = Number((hazardRows[0] as Record<string, unknown>)?.cnt ?? 0);
      const hazardTrend = openHazards > 3 ? 'up' : openHazards === 0 ? 'down' : 'stable';

      const inspDueRows = Array.from(
        await tx.execute(sql`SELECT count(*)::int AS cnt FROM safety_inspections WHERE ${orgFilter} AND ${dateFilter}`)
      );
      const inspectionsDue = Number((inspDueRows[0] as Record<string, unknown>)?.cnt ?? 0);

      const inspCompRows = Array.from(
        await tx.execute(sql`SELECT count(*)::int AS cnt FROM safety_inspections WHERE ${orgFilter} AND status = 'completed' AND ${dateFilter}`)
      );
      const inspectionsCompleted = Number((inspCompRows[0] as Record<string, unknown>)?.cnt ?? 0);
      // No inspections in the period is not a 100% rate: it is no measurement.
      const inspectionComplianceRate = inspectionsDue > 0
        ? Math.round((inspectionsCompleted / inspectionsDue) * 100)
        : null;

      const lastRows = Array.from(
        await tx.execute(sql`SELECT max(created_at)::text AS last_dt FROM workplace_incidents WHERE ${orgFilter} AND status <> 'archived'`)
      );
      const lastDt = (lastRows[0] as Record<string, unknown>)?.last_dt as string | null;
      // No incident on record is not 90 days: it is no measurement.
      const daysWithoutIncident = lastDt
        ? Math.max(0, Math.floor((Date.now() - new Date(lastDt).getTime()) / 86_400_000))
        : null;

      const critRows = Array.from(
        await tx.execute(sql`SELECT count(*)::int AS cnt FROM workplace_incidents WHERE ${orgFilter} AND severity = 'critical' AND status NOT IN ('closed','archived')`)
      );
      const criticalAlerts = Number((critRows[0] as Record<string, unknown>)?.cnt ?? 0);

      // safety_training_records holds no completion, due-date or status column, so a compliance rate cannot be computed
      // from it. It used to be the constant 92 (or 100 with no rows). It is reported as not measured.
      const trainingCompliance = null;

      const ppeRows = Array.from(
        await tx.execute(sql`SELECT count(*)::int AS cnt FROM ppe_equipment WHERE ${orgFilter} AND quantity_in_stock < reorder_level`)
      );
      const ppeInventoryLow = Number((ppeRows[0] as Record<string, unknown>)?.cnt ?? 0);

    return {
      success: true,
      metrics: {
        totalIncidents,
        incidentTrend,
        incidentChange,
        openHazards,
        hazardTrend,
        inspectionsDue,
        inspectionsCompleted,
        inspectionComplianceRate,
        daysWithoutIncident,
        criticalAlerts,
        trainingCompliance,
        ppeInventoryLow,
      },
    };
    }); // withRLSContext
    } catch (error) {
      // A failed query is an error, not a dashboard of zeros with success: true.
      const { logger: log } = await import('@/lib/logger');
      log.error('Health-safety dashboard query failed', { error: error instanceof Error ? error.message : 'Unknown' });
      throw ApiError.internal('Failed to load health and safety metrics');
    }
  },
);
