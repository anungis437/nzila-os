/**
 * GET /api/health-safety/hazards/stats
 * Summary counts by status + count of critical open hazards for the
 * HazardsPage overview cards.
 * Returns { total, open, in_progress, resolved, critical, avg_resolution_time }.
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
      summary: 'Hazard report summary stats',
    },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId');
    const orgFilter = organizationId ? sql`organization_id = ${organizationId}` : sql`1=1`;

    const empty = {
      total: 0,
      open: 0,
      in_progress: 0,
      resolved: 0,
      critical: 0,
      avg_resolution_time: 0,
    };

    try {
      return await withRLSContext(async () => {
        const rows = Array.from(
          await db.execute(sql`
            SELECT
              count(*)::int AS total,
              count(*) FILTER (WHERE status = 'reported')::int AS open,
              count(*) FILTER (WHERE status IN ('assessed','assigned'))::int AS in_progress,
              count(*) FILTER (WHERE status IN ('resolved','closed'))::int AS resolved,
              count(*) FILTER (
                WHERE hazard_level IN ('critical','extreme')
                  AND status NOT IN ('resolved','closed')
              )::int AS critical,
              COALESCE(
                AVG(EXTRACT(EPOCH FROM (resolution_date - reported_date)) / 86400.0)
                  FILTER (WHERE resolution_date IS NOT NULL AND reported_date IS NOT NULL),
                0
              )::float AS avg_resolution_time
            FROM hazard_reports
            WHERE ${orgFilter}
          `),
        );
        const r = (rows[0] as Record<string, unknown>) ?? {};
        return {
          total: Number(r.total ?? 0),
          open: Number(r.open ?? 0),
          in_progress: Number(r.in_progress ?? 0),
          resolved: Number(r.resolved ?? 0),
          critical: Number(r.critical ?? 0),
          avg_resolution_time: Number(r.avg_resolution_time ?? 0),
        };
      });
    } catch (error) {
      const { logger: log } = await import('@/lib/logger');
      log.error('Health-safety hazards stats query failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return empty;
    }
  },
);
