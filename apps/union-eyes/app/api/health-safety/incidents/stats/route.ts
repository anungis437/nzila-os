/**
 * GET /api/health-safety/incidents/stats
 * Summary counts by status + avg resolution time (days) for the
 * IncidentsPage overview cards.
 * Returns { total, reported, investigating, resolved, closed, avgResolutionTime }.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
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
      summary: 'Workplace incident summary stats',
    },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId');
    const period = url.searchParams.get('period') || '30d';
    const startDate = getStartDate(period);
    const orgFilter = organizationId ? sql`organization_id = ${organizationId}` : sql`1=1`;
    const dateFilter = sql`created_at >= ${startDate}::timestamptz`;

    const empty = {
      total: 0,
      reported: 0,
      investigating: 0,
      resolved: 0,
      closed: 0,
      avgResolutionTime: 0,
    };

    try {
      return await withRLSContext(async () => {
        const rows = Array.from(
          await db.execute(sql`
            SELECT
              count(*)::int AS total,
              count(*) FILTER (WHERE status = 'reported')::int AS reported,
              count(*) FILTER (WHERE status = 'investigating')::int AS investigating,
              count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
              count(*) FILTER (WHERE status = 'closed')::int AS closed,
              COALESCE(
                AVG(EXTRACT(EPOCH FROM (closed_date - reported_date)) / 86400.0)
                  FILTER (WHERE closed_date IS NOT NULL AND reported_date IS NOT NULL),
                0
              )::float AS avg_resolution_time
            FROM workplace_incidents
            WHERE ${orgFilter} AND ${dateFilter}
          `),
        );
        const r = (rows[0] as Record<string, unknown>) ?? {};
        return {
          total: Number(r.total ?? 0),
          reported: Number(r.reported ?? 0),
          investigating: Number(r.investigating ?? 0),
          resolved: Number(r.resolved ?? 0),
          closed: Number(r.closed ?? 0),
          avgResolutionTime: Number(r.avg_resolution_time ?? 0),
        };
      });
    } catch (error) {
      const { logger: log } = await import('@/lib/logger');
      log.error('Health-safety incidents stats query failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return empty;
    }
  },
);
