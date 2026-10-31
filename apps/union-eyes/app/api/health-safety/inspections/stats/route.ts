/**
 * GET /api/health-safety/inspections/stats
 * Summary statistics for safety inspections.
 * Returns { total, scheduled, completed, overdue, complianceRate, avgScore }.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Health-safety'],
      summary: 'Safety inspection summary statistics',
    },
  },
  async ({ organizationId }) => {
    // With no organization the query used to run unscoped (1=1) and count every tenant's rows; it now refuses.
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const orgFilter = sql`organization_id = ${organizationId}`;

    const rows = Array.from(
      await withRLSContext(async () =>
        db.execute(sql`
          SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
            count(*) FILTER (WHERE status = 'completed')::int AS completed,
            count(*) FILTER (WHERE status = 'overdue')::int AS overdue,
            (100.0 * sum(items_passed) / NULLIF(sum(total_items_checked), 0)) AS compliance_rate,
            avg(score_percentage) FILTER (WHERE score_percentage IS NOT NULL) AS avg_score
          FROM safety_inspections
          WHERE ${orgFilter}
        `)
      )
    );

    const row = (rows[0] ?? {}) as Record<string, unknown>;

    return {
      total: Number(row.total ?? 0),
      scheduled: Number(row.scheduled ?? 0),
      completed: Number(row.completed ?? 0),
      overdue: Number(row.overdue ?? 0),
      complianceRate: row.compliance_rate != null
        ? Math.round(Number(row.compliance_rate) * 10) / 10
        : 0,
      avgScore: row.avg_score != null
        ? Math.round(Number(row.avg_score) * 10) / 10
        : 0,
    };
  },
);
