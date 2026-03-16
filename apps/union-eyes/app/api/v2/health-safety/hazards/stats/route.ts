/**
 * GET /api/v2/health-safety/hazards/stats
 * Aggregate hazard statistics for the hazards page.
 */
import { withApi } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Health-safety'], summary: 'Hazard stats' },
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
            count(*) FILTER (WHERE status IN ('reported','assessed'))::int AS open,
            count(*) FILTER (WHERE status = 'assigned')::int AS in_progress,
            count(*) FILTER (WHERE status IN ('resolved','closed'))::int AS resolved,
            count(*) FILTER (WHERE hazard_level = 'critical' OR hazard_level = 'imminent')::int AS critical,
            ROUND(COALESCE(AVG(EXTRACT(EPOCH FROM (resolution_date - created_at)) / 3600) FILTER (WHERE resolution_date IS NOT NULL), 0))::int AS avg_hours
          FROM hazard_reports
          WHERE ${orgFilter}
        `)
      );
      const r = (rows[0] ?? {}) as Record<string, unknown>;

      return {
        total: Number(r.total ?? 0),
        open: Number(r.open ?? 0),
        inProgress: Number(r.in_progress ?? 0),
        resolved: Number(r.resolved ?? 0),
        critical: Number(r.critical ?? 0),
        avgResolutionTime: `${Number(r.avg_hours ?? 0)}h`,
      };
    });
  },
);
