/**
 * Nzila OS — Audit Insights CSV Export
 *
 * Returns aggregated audit data as CSV download.
 * Platform admin sees all; org-scoped users see only their org.
 */
import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/api-guards'
import { platformDb } from '@nzila/db/platform'
import { auditEvents, entities } from '@nzila/db/schema'
import { eq, count, desc, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response

  const { platformRole } = authResult
  const isPlatformAdmin = platformRole === 'platform_admin' || platformRole === 'studio_admin'
  const orgId = req.nextUrl.searchParams.get('orgId')

  if (!isPlatformAdmin && !orgId) {
    return NextResponse.json({ error: 'orgId is required for non-platform users' }, { status: 400 })
  }

  const baseQuery = platformDb
    .select({
      targetType: auditEvents.targetType,
      action: auditEvents.action,
      entityId: auditEvents.entityId,
      entityName: entities.legalName,
      total: count().as('total'),
    })
    .from(auditEvents)
    .leftJoin(entities, eq(auditEvents.entityId, entities.id))

  const query = orgId
    ? baseQuery.where(eq(auditEvents.entityId, orgId))
    : baseQuery

  const rows = await query
    .groupBy(auditEvents.targetType, auditEvents.action, auditEvents.entityId, entities.legalName)
    .orderBy(desc(sql`count(*)`))
    .limit(10000)

  const header = 'target_type,action,entity_id,entity_name,total'
  const lines = rows.map(
    (r) =>
      `${r.targetType},${r.action},${r.entityId},"${(r.entityName ?? '').replace(/"/g, '""')}",${r.total}`,
  )
  const csv = [header, ...lines].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-insights-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
