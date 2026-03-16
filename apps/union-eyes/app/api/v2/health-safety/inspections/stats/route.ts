/**
 * GET /api/v2/health-safety/inspections/stats
 * Aggregate inspection statistics for the inspections page.
 */
import { withApi } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Health-safety'], summary: 'Inspection stats' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId');
    const orgFilter = organizationId ? sql`organization_id = ${organizationId}` : sql`1=1`;

    return withRLSContext(async (db) => {
      const rows = Array.from(
        await db.execute(sql`
          SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
            count(*) FILTER (WHERE status = 'completed' OR status = 'followup_complete')::int AS completed,
            count(*) FILTER (WHERE status = 'overdue')::int AS overdue,
            ROUND(COALESCE(AVG(score_percentage), 0))::int AS avg_score
          FROM safety_inspections
          WHERE ${orgFilter}
        `)
      );
      const r = (rows[0] ?? {}) as Record<string, unknown>;

      const total = Number(r.total ?? 0);
      const completed = Number(r.completed ?? 0);
      const complianceRate = total > 0 ? Math.round((completed / total) * 100) : 100;

      return {
        total,
        scheduled: Number(r.scheduled ?? 0),
        completed,
        overdue: Number(r.overdue ?? 0),
        complianceRate,
        avgScore: Number(r.avg_score ?? 0),
      };
    });
  },
);
