/**
 * GET /api/health-safety/incidents/stats
 * Summary statistics for workplace incidents within a rolling window.
 * Returns { total, reported, investigating, resolved, closed, avgResolutionTime }.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

function getStartDateISO(period: string): string {
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
      summary: 'Workplace incident summary statistics',
    },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '30d';
    const startISO = getStartDateISO(period);
    const orgFilter = organizationId ? sql`organization_id = ${organizationId}` : sql`1=1`;

    const rows = Array.from(
      await withRLSContext(async () =>
        db.execute(sql`
          SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE status = 'reported')::int AS reported,
            count(*) FILTER (WHERE status = 'investigating')::int AS investigating,
            count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
            count(*) FILTER (WHERE status = 'closed')::int AS closed,
            avg(EXTRACT(EPOCH FROM (closed_date - reported_date)) / 86400.0)
              FILTER (WHERE closed_date IS NOT NULL) AS avg_resolution_days
          FROM workplace_incidents
          WHERE ${orgFilter} AND incident_date >= ${startISO}::timestamptz
        `)
      )
    );

    const row = (rows[0] ?? {}) as Record<string, unknown>;

    return {
      total: Number(row.total ?? 0),
      reported: Number(row.reported ?? 0),
      investigating: Number(row.investigating ?? 0),
      resolved: Number(row.resolved ?? 0),
      closed: Number(row.closed ?? 0),
      avgResolutionTime: row.avg_resolution_days != null
        ? Math.round(Number(row.avg_resolution_days) * 10) / 10
        : 0,
    };
  },
);
