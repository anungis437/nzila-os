/**
 * GET /api/health-safety/hazards/stats
 * Summary statistics for workplace hazard reports.
 * Returns { total, open, inProgress, resolved, critical, avgResolutionTime }.
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
      summary: 'Hazard report summary statistics',
    },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId');
    const orgFilter = organizationId ? sql`organization_id = ${organizationId}` : sql`1=1`;

    const rows = Array.from(
      await withRLSContext(async () =>
        db.execute(sql`
          SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE status NOT IN ('resolved', 'closed'))::int AS open,
            count(*) FILTER (WHERE status = 'assigned')::int AS in_progress,
            count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
            count(*) FILTER (WHERE hazard_level IN ('critical', 'extreme') AND status NOT IN ('resolved', 'closed'))::int AS critical,
            avg(EXTRACT(EPOCH FROM (resolution_date - reported_date)) / 86400.0)
              FILTER (WHERE resolution_date IS NOT NULL) AS avg_resolution_days
          FROM hazard_reports
          WHERE ${orgFilter}
        `)
      )
    );

    const row = (rows[0] ?? {}) as Record<string, unknown>;

    return {
      total: Number(row.total ?? 0),
      open: Number(row.open ?? 0),
      inProgress: Number(row.in_progress ?? 0),
      resolved: Number(row.resolved ?? 0),
      critical: Number(row.critical ?? 0),
      avgResolutionTime: row.avg_resolution_days != null
        ? Math.round(Number(row.avg_resolution_days) * 10) / 10
        : 0,
    };
  },
);
