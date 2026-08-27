/**
 * GET /api/health-safety/inspections/stats
 * Summary counts by status + compliance rate + avg score for the
 * InspectionsPage overview cards.
 * Returns { total, scheduled, completed, overdue, compliance_rate, avg_score }.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Health-safety'],
      summary: 'Safety inspection summary stats',
    },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId');
    const orgFilter = organizationId ? sql`organization_id = ${organizationId}` : sql`1=1`;

    const empty = {
      total: 0,
      scheduled: 0,
      completed: 0,
      overdue: 0,
      compliance_rate: 0,
      avg_score: 0,
    };

    try {
      return await withRLSContext(async () => {
        const rows = Array.from(
          await db.execute(sql`
            SELECT
              count(*)::int AS total,
              count(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
              count(*) FILTER (WHERE status IN ('completed','followup_complete'))::int AS completed,
              count(*) FILTER (
                WHERE status = 'overdue'
                   OR (due_date IS NOT NULL AND due_date < NOW()
                       AND status NOT IN ('completed','followup_complete','cancelled'))
              )::int AS overdue,
              COALESCE(
                AVG(score_percentage) FILTER (WHERE score_percentage IS NOT NULL),
                0
              )::float AS avg_score
            FROM safety_inspections
            WHERE ${orgFilter}
          `),
        );
        const r = (rows[0] as Record<string, unknown>) ?? {};
        const completed = Number(r.completed ?? 0);
        const overdue = Number(r.overdue ?? 0);
        const denom = completed + overdue;
        const complianceRate = denom > 0 ? Math.round((completed / denom) * 100) : 100;
        return {
          total: Number(r.total ?? 0),
          scheduled: Number(r.scheduled ?? 0),
          completed,
          overdue,
          compliance_rate: complianceRate,
          avg_score: Number(r.avg_score ?? 0),
        };
      });
    } catch (error) {
      const { logger: log } = await import('@/lib/logger');
      log.error('Health-safety inspections stats query failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return empty;
    }
  },
);
