/**
 * GET /api/health-safety/incidents/trends
 * Returns incident trend data grouped by date with severity breakdown.
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
      summary: 'Incident trend data over time',
    },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId');
    const period = url.searchParams.get('period') || '30d';
    const startISO = getStartDateISO(period);
    const isMonthly = period === '12m';

    let rows: Record<string, unknown>[];
    if (organizationId) {
      if (isMonthly) {
        rows = Array.from(await withRLSContext(async () => db.execute(sql`
          SELECT to_char(date_trunc('month', incident_date), 'YYYY-MM-DD') AS date,
            COUNT(*) FILTER (WHERE severity IN ('near_miss','minor')) AS minor,
            COUNT(*) FILTER (WHERE severity IN ('moderate','serious')) AS major,
            COUNT(*) FILTER (WHERE severity IN ('critical','fatal')) AS critical,
            COUNT(*) AS total
          FROM workplace_incidents
          WHERE organization_id = ${organizationId}
            AND incident_date >= ${startISO}::timestamptz
          GROUP BY date_trunc('month', incident_date)
          ORDER BY date_trunc('month', incident_date) ASC
        `)));
      } else {
        rows = Array.from(await withRLSContext(async () => db.execute(sql`
          SELECT to_char(date_trunc('day', incident_date), 'YYYY-MM-DD') AS date,
            COUNT(*) FILTER (WHERE severity IN ('near_miss','minor')) AS minor,
            COUNT(*) FILTER (WHERE severity IN ('moderate','serious')) AS major,
            COUNT(*) FILTER (WHERE severity IN ('critical','fatal')) AS critical,
            COUNT(*) AS total
          FROM workplace_incidents
          WHERE organization_id = ${organizationId}
            AND incident_date >= ${startISO}::timestamptz
          GROUP BY date_trunc('day', incident_date)
          ORDER BY date_trunc('day', incident_date) ASC
        `)));
      }
    } else {
      if (isMonthly) {
        rows = Array.from(await withRLSContext(async () => db.execute(sql`
          SELECT to_char(date_trunc('month', incident_date), 'YYYY-MM-DD') AS date,
            COUNT(*) FILTER (WHERE severity IN ('near_miss','minor')) AS minor,
            COUNT(*) FILTER (WHERE severity IN ('moderate','serious')) AS major,
            COUNT(*) FILTER (WHERE severity IN ('critical','fatal')) AS critical,
            COUNT(*) AS total
          FROM workplace_incidents
          WHERE incident_date >= ${startISO}::timestamptz
          GROUP BY date_trunc('month', incident_date)
          ORDER BY date_trunc('month', incident_date) ASC
        `)));
      } else {
        rows = Array.from(await withRLSContext(async () => db.execute(sql`
          SELECT to_char(date_trunc('day', incident_date), 'YYYY-MM-DD') AS date,
            COUNT(*) FILTER (WHERE severity IN ('near_miss','minor')) AS minor,
            COUNT(*) FILTER (WHERE severity IN ('moderate','serious')) AS major,
            COUNT(*) FILTER (WHERE severity IN ('critical','fatal')) AS critical,
            COUNT(*) AS total
          FROM workplace_incidents
          WHERE incident_date >= ${startISO}::timestamptz
          GROUP BY date_trunc('day', incident_date)
          ORDER BY date_trunc('day', incident_date) ASC
        `)));
      }
    }

    return rows.map((row) => ({
      date: String(row.date),
      minor: Number(row.minor ?? 0),
      major: Number(row.major ?? 0),
      critical: Number(row.critical ?? 0),
      total: Number(row.total ?? 0),
    }));
  }
);
