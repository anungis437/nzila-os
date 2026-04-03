/**
 * Zonga Creator Analytics API
 *
 * GET /api/analytics — Returns creator revenue, engagement, and performance metrics.
 * Org-scoped, auth-gated, evidence-backed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, getAuditedDb, requireOrgAccess } from '@/lib/api-guards'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'

export async function GET(req: NextRequest) {
  return withOrgScope(req, () =>
    withSpan('zonga.analytics.get', { 'http.method': 'GET' }, async () => {
    const user = await authenticateUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await requireOrgAccess(req, user)
    if (!orgId) {
      return NextResponse.json({ error: 'Org access required' }, { status: 403 })
    }

    const db = getAuditedDb(user.id, orgId)
    const { searchParams } = new URL(req.url)
    const creatorId = searchParams.get('creatorId')
    const period = searchParams.get('period') ?? '30d'

    const periodDays = parsePeriod(period)
    const since = new Date(Date.now() - periodDays * 86_400_000).toISOString()

    const [revenueMetrics, payoutMetrics, eventMetrics] = await Promise.all([
      getRevenueMetrics(db, orgId, creatorId, since),
      getPayoutMetrics(db, orgId, creatorId, since),
      getEventMetrics(db, orgId, creatorId, since),
    ])

    return NextResponse.json({
      orgId,
      period,
      creatorId: creatorId ?? 'all',
      revenue: revenueMetrics,
      payouts: payoutMetrics,
      events: eventMetrics,
      generatedAt: new Date().toISOString(),
    })
  }),
  )
}

function parsePeriod(period: string): number {
  const match = period.match(/^(\d+)d$/)
  if (match) return Math.min(Number(match[1]), 365)
  return 30
}

async function getRevenueMetrics(db: ReturnType<typeof getAuditedDb>, orgId: string, creatorId: string | null, since: string) {
  try {
    const { sql } = await import('drizzle-orm')
    const whereCreator = creatorId ? sql`AND creator_id = ${creatorId}` : sql``
    const rows = await db.execute(sql`
      SELECT
        revenue_type,
        COUNT(*)::int AS event_count,
        COALESCE(SUM(amount), 0)::numeric AS total_amount,
        COALESCE(AVG(amount), 0)::numeric AS avg_amount
      FROM zonga_revenue_events
      WHERE org_id = ${orgId}
        AND created_at >= ${since}::timestamptz
        ${whereCreator}
      GROUP BY revenue_type
      ORDER BY total_amount DESC
    `)
    return rows ?? []
  } catch {
    return []
  }
}

async function getPayoutMetrics(db: ReturnType<typeof getAuditedDb>, orgId: string, creatorId: string | null, since: string) {
  try {
    const { sql } = await import('drizzle-orm')
    const whereCreator = creatorId ? sql`AND creator_id = ${creatorId}` : sql``
    const rows = await db.execute(sql`
      SELECT
        status,
        COUNT(*)::int AS count,
        COALESCE(SUM(amount), 0)::numeric AS total_amount
      FROM zonga_payouts
      WHERE org_id = ${orgId}
        AND created_at >= ${since}::timestamptz
        ${whereCreator}
      GROUP BY status
    `)
    return rows ?? []
  } catch {
    return []
  }
}

async function getEventMetrics(db: ReturnType<typeof getAuditedDb>, orgId: string, creatorId: string | null, since: string) {
  try {
    const { sql } = await import('drizzle-orm')
    const whereCreator = creatorId ? sql`AND creator_id = ${creatorId}` : sql``
    const rows = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total_events,
        COUNT(*) FILTER (WHERE status = 'published')::int AS published_events,
        COALESCE(SUM(
          (SELECT COUNT(*) FROM zonga_ticket_purchases tp WHERE tp.event_id = e.id)
        ), 0)::int AS total_tickets_sold
      FROM zonga_events e
      WHERE e.org_id = ${orgId}
        AND e.created_at >= ${since}::timestamptz
        ${whereCreator}
    `)
    return rows?.[0] ?? { total_events: 0, published_events: 0, total_tickets_sold: 0 }
  } catch {
    return { total_events: 0, published_events: 0, total_tickets_sold: 0 }
  }
}
