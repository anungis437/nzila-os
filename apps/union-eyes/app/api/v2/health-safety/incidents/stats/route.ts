/**
 * GET /api/v2/health-safety/incidents/stats
 * Aggregate incident statistics for the incidents page.
 */
import { withApi } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Health-safety'], summary: 'Incident stats' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId');
    const period = url.searchParams.get('period') || '30d';
    const orgFilter = organizationId ? sql`organization_id = ${organizationId}` : sql`1=1`;

    const ms: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 };
    const days = ms[period] ?? 30;
    const startDate = new Date(Date.now() - days * 86_400_000);
    const dateFilter = sql`created_at >= ${startDate}`;

    return withRLSContext(async (db) => {
      const rows = Array.from(
        await db.execute(sql`
          SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE status = 'reported')::int AS reported,
            count(*) FILTER (WHERE status = 'investigating')::int AS investigating,
            count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
            count(*) FILTER (WHERE status = 'closed')::int AS closed,
            ROUND(COALESCE(AVG(EXTRACT(EPOCH FROM (closed_date - created_at)) / 3600) FILTER (WHERE closed_date IS NOT NULL), 0))::int AS avg_hours
          FROM workplace_incidents
          WHERE ${orgFilter} AND ${dateFilter}
        `)
      );
      const r = (rows[0] ?? {}) as Record<string, unknown>;

      return {
        total: Number(r.total ?? 0),
        reported: Number(r.reported ?? 0),
        investigating: Number(r.investigating ?? 0),
        resolved: Number(r.resolved ?? 0),
        closed: Number(r.closed ?? 0),
        avgResolutionTime: `${Number(r.avg_hours ?? 0)}h`,
      };
    });
  },
);
