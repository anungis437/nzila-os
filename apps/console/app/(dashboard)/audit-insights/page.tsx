/**
 * Nzila OS — Cross-App Audit Insights
 *
 * Aggregates audit events across all apps, grouped by app_name, event_type, and org.
 * Platform admins see all; org users see only their org.
 * Includes CSV export.
 */
import { currentUser } from '@clerk/nextjs/server'
import { getUserRole } from '@/lib/rbac'
import { platformDb } from '@nzila/db/platform'
import { auditEvents, entities } from '@nzila/db/schema'
import { eq, sql, count, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

interface AuditGroupRow {
  targetType: string
  action: string
  entityId: string
  entityName: string | null
  total: number
}

async function getPlatformAuditInsights(): Promise<AuditGroupRow[]> {
  const rows = await platformDb
    .select({
      targetType: auditEvents.targetType,
      action: auditEvents.action,
      entityId: auditEvents.entityId,
      entityName: entities.legalName,
      total: count().as('total'),
    })
    .from(auditEvents)
    .leftJoin(entities, eq(auditEvents.entityId, entities.id))
    .groupBy(
      auditEvents.targetType,
      auditEvents.action,
      auditEvents.entityId,
      entities.legalName,
    )
    .orderBy(desc(sql`count(*)`))
    .limit(200)

  return rows.map((r) => ({
    targetType: r.targetType,
    action: r.action,
    entityId: r.entityId,
    entityName: r.entityName,
    total: r.total,
  }))
}

async function getOrgAuditInsights(orgId: string): Promise<AuditGroupRow[]> {
  const rows = await platformDb
    .select({
      targetType: auditEvents.targetType,
      action: auditEvents.action,
      entityId: auditEvents.entityId,
      entityName: entities.legalName,
      total: count().as('total'),
    })
    .from(auditEvents)
    .leftJoin(entities, eq(auditEvents.entityId, entities.id))
    .where(eq(auditEvents.entityId, orgId))
    .groupBy(
      auditEvents.targetType,
      auditEvents.action,
      auditEvents.entityId,
      entities.legalName,
    )
    .orderBy(desc(sql`count(*)`))
    .limit(200)

  return rows.map((r) => ({
    targetType: r.targetType,
    action: r.action,
    entityId: r.entityId,
    entityName: r.entityName,
    total: r.total,
  }))
}

function insightsToCsv(rows: AuditGroupRow[]): string {
  const header = 'target_type,action,entity_id,entity_name,total'
  const lines = rows.map(
    (r) =>
      `${r.targetType},${r.action},${r.entityId},"${r.entityName ?? ''}",${r.total}`,
  )
  return [header, ...lines].join('\n')
}

export default async function AuditInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; orgId?: string; export?: string }>
}) {
  const _user = await currentUser()
  const role = await getUserRole()
  const params = await searchParams
  const isExecutive = params.mode === 'executive'
  const isPlatformAdmin = role === 'platform_admin' || role === 'studio_admin'

  const orgId = params.orgId
  const rows = isPlatformAdmin && !orgId
    ? await getPlatformAuditInsights()
    : orgId
      ? await getOrgAuditInsights(orgId)
      : []

  // Compute mutation density: mutations / total events
  const totalEvents = rows.reduce((sum, r) => sum + r.total, 0)
  const mutationEvents = rows
    .filter((r) => r.action.includes('create') || r.action.includes('update') || r.action.includes('execute'))
    .reduce((sum, r) => sum + r.total, 0)
  const mutationDensity = totalEvents > 0 ? ((mutationEvents / totalEvents) * 100).toFixed(1) : '0.0'

  // Most active orgs
  const orgTotals = new Map<string, { name: string; total: number }>()
  for (const r of rows) {
    const existing = orgTotals.get(r.entityId)
    if (existing) {
      existing.total += r.total
    } else {
      orgTotals.set(r.entityId, { name: r.entityName ?? r.entityId, total: r.total })
    }
  }
  const mostActiveOrgs = [...orgTotals.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)

  const csvData = insightsToCsv(rows)

  return (
    <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Insights</h1>
          <p className="text-gray-500 mt-1">
            Cross-app audit event aggregation
          </p>
        </div>
        <form method="GET" action="/api/audit-insights/export">
          {orgId && <input type="hidden" name="orgId" value={orgId} />}
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Export CSV
          </button>
        </form>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Total Events</p>
          <p className="text-2xl font-bold text-gray-900">{totalEvents.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Mutation Density</p>
          <p className="text-2xl font-bold text-gray-900">{mutationDensity}%</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Active Orgs</p>
          <p className="text-2xl font-bold text-gray-900">{orgTotals.size}</p>
        </div>
      </div>

      {/* Most active orgs */}
      {isPlatformAdmin && mostActiveOrgs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Most Active Organizations</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Organization</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium">Events</th>
                </tr>
              </thead>
              <tbody>
                {mostActiveOrgs.map(([id, { name, total }]) => (
                  <tr key={id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-900">{name}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Event breakdown table */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Event Breakdown</h2>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Target Type</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Action</th>
              {isPlatformAdmin && (
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Organization</th>
              )}
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((row, i) => (
              <tr key={`${row.entityId}-${row.action}-${i}`} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-900 font-mono text-xs">{row.targetType}</td>
                <td className="px-4 py-3 text-gray-700 font-mono text-xs">{row.action}</td>
                {isPlatformAdmin && (
                  <td className="px-4 py-3 text-gray-600">{row.entityName ?? row.entityId.slice(0, 8)}</td>
                )}
                <td className="px-4 py-3 text-right text-gray-900 font-semibold">{row.total.toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No audit events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Hidden CSV data for client-side download */}
      <script
        type="application/json"
        id="audit-csv-data"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(csvData) }}
      />
    </div>
  )
}
