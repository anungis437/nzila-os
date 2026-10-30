/**
 * GET /api/health-safety/incidents/trends
 * Tenant-scoped incident trends. Never accept a caller-selected organizationId:
 * absence of the query parameter must not broaden the aggregate to all tenants.
 *
 * DEF-0B8-HS-TRENDS-ORGANIZATION-FROM-QUERY-AND-NO-PREDICATE-WHEN-ABSENT
 */
import { withApi, ApiError } from '@/lib/api/framework'
import { sql } from 'drizzle-orm'
import { withRLSContext } from '@/lib/db/with-rls-context'

export const dynamic = 'force-dynamic'

const PERIODS = new Set(['7d', '30d', '90d', '12m'])

function getStartDateISO(period: string): string {
  const now = new Date()
  switch (period) {
    case '7d': return new Date(now.getTime() - 7 * 86_400_000).toISOString()
    case '30d': return new Date(now.getTime() - 30 * 86_400_000).toISOString()
    case '90d': return new Date(now.getTime() - 90 * 86_400_000).toISOString()
    case '12m': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString()
    default: throw ApiError.badRequest('Unsupported trend period')
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
  async ({ request, organizationId }) => {
    if (!organizationId) throw ApiError.forbidden('Organization context required')

    const url = new URL(request.url)
    const period = url.searchParams.get('period') || '30d'
    if (!PERIODS.has(period)) throw ApiError.badRequest('Unsupported trend period')
    const startISO = getStartDateISO(period)

    // Use the authenticated tenant both as the explicit query predicate and as
    // the RLS transaction binding. Never read the organizationId query parameter.
    const rows = await withRLSContext({ organizationId }, async (tx) => {
      if (period === '12m') {
        return Array.from(await tx.execute(sql`
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
        `))
      }
      return Array.from(await tx.execute(sql`
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
      `))
    })

    return rows.map((row) => ({
      date: String(row.date),
      minor: Number(row.minor ?? 0),
      major: Number(row.major ?? 0),
      critical: Number(row.critical ?? 0),
      total: Number(row.total ?? 0),
    }))
  },
)
