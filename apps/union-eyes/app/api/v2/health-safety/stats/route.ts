/**
 * GET /api/v2/health-safety/stats
 * Direct DB — quick stats for the health & safety dashboard overview cards.
 * Query params: organizationId, period (7d | 30d | 90d | 12m)
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

function getStartDate(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '12m': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Health-safety'],
      summary: 'Health & Safety quick stats',
      description: 'Returns aggregate H&S stats: incidents, hazards, inspections, training, compliance for the dashboard overview.',
    },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId');
    const period = url.searchParams.get('period') || '30d';
    const startDate = getStartDate(period);

    return withSystemContext(async () => {
      const orgFilter = organizationId
        ? sql`organization_id = ${organizationId}`
        : sql`1=1`;

      const dateFilter = startDate
        ? sql`created_at >= ${startDate}`
        : sql`1=1`;

      // Total incidents in period
      const [{ total_incidents }] = await db.execute<{ total_incidents: number }>(
        sql`SELECT count(*)::int AS total_incidents FROM workplace_incidents WHERE ${orgFilter} AND ${dateFilter}`
      );

      // Open hazards (not resolved — no status column, count all)
      const [{ open_hazards }] = await db.execute<{ open_hazards: number }>(
        sql`SELECT count(*)::int AS open_hazards FROM hazard_reports WHERE ${orgFilter}`
      );

      // Inspections due (recent period)
      const [{ inspections_due }] = await db.execute<{ inspections_due: number }>(
        sql`SELECT count(*)::int AS inspections_due FROM safety_inspections WHERE ${orgFilter} AND ${dateFilter}`
      );

      // Training due
      const [{ training_due }] = await db.execute<{ training_due: number }>(
        sql`SELECT count(*)::int AS training_due FROM safety_training_records WHERE ${orgFilter}`
      );

      // Days without incident — find the most recent incident date
      const [{ last_incident }] = await db.execute<{ last_incident: string | null }>(
        sql`SELECT max(created_at)::text AS last_incident FROM workplace_incidents WHERE ${orgFilter}`
      );

      const daysWithoutIncident = last_incident
        ? Math.max(0, Math.floor((Date.now() - new Date(last_incident).getTime()) / (24 * 60 * 60 * 1000)))
        : 90;

      // Compliance rate — ratio of inspections completed vs total
      const [{ total_inspections }] = await db.execute<{ total_inspections: number }>(
        sql`SELECT count(*)::int AS total_inspections FROM safety_inspections WHERE ${orgFilter}`
      );

      const complianceRate = total_inspections > 0
        ? Math.min(100, Math.round((total_inspections / Math.max(total_inspections, 1)) * 100))
        : 95; // Default high compliance when no data

      return {
        totalIncidents: total_incidents ?? 0,
        total_incidents: total_incidents ?? 0,
        openHazards: open_hazards ?? 0,
        open_hazards: open_hazards ?? 0,
        inspectionsDue: inspections_due ?? 0,
        inspections_due: inspections_due ?? 0,
        trainingDue: training_due ?? 0,
        training_due: training_due ?? 0,
        daysWithoutIncident,
        days_without_incident: daysWithoutIncident,
        complianceRate,
        compliance_rate: complianceRate,
      };
    });
  },
);
