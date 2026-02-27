/**
 * Nzila OS — Audit Graph (Immutability Visualization)
 *
 * Visualizes audit event chain, integrity hash linkage,
 * and cross-app event density.
 * Derived from audit table. Org-scoped. Read-only.
 */
import { requireRole, getUserRole } from '@/lib/rbac'
import { platformDb } from '@nzila/db/platform'
import { auditEvents, entities } from '@nzila/db/schema'
import { eq, count, sql, desc, gte } from 'drizzle-orm'
import { createHash } from 'crypto'
import {
  LinkIcon,
  FingerPrintIcon,
  ChartBarIcon,
  ClockIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// ── Data types ──────────────────────────────────────────────────────────────

interface AuditChainEntry {
  id: string
  action: string
  targetType: string
  actorRole: string | null
  createdAt: Date
  integrityHash: string
}

interface CrossAppDensity {
  targetType: string
  eventCount: number
  percentage: number
}

// ── Data fetching ───────────────────────────────────────────────────────────

async function getAuditChain(
  orgId: string | null,
  limit: number = 20,
): Promise<AuditChainEntry[]> {
  const baseQuery = platformDb
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      targetType: auditEvents.targetType,
      actorRole: auditEvents.actorRole,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)

  const rows = orgId
    ? await baseQuery
        .where(eq(auditEvents.entityId, orgId))
        .orderBy(desc(auditEvents.createdAt))
        .limit(limit)
    : await baseQuery.orderBy(desc(auditEvents.createdAt)).limit(limit)

  // Compute integrity hash chain — each entry hash includes the previous
  let prevHash = '0000000000000000'
  return rows.map((row) => {
    const data = `${prevHash}:${row.id}:${row.action}:${row.createdAt.toISOString()}`
    const integrityHash = createHash('sha256').update(data).digest('hex').slice(0, 16)
    prevHash = integrityHash
    return { ...row, integrityHash }
  })
}

async function getCrossAppDensity(orgId: string | null): Promise<CrossAppDensity[]> {
  const baseQuery = platformDb
    .select({
      targetType: auditEvents.targetType,
      eventCount: count().as('event_count'),
    })
    .from(auditEvents)

  const rows = orgId
    ? await baseQuery
        .where(eq(auditEvents.entityId, orgId))
        .groupBy(auditEvents.targetType)
        .orderBy(desc(sql`event_count`))
    : await baseQuery
        .groupBy(auditEvents.targetType)
        .orderBy(desc(sql`event_count`))

  const total = rows.reduce((sum, r) => sum + r.eventCount, 0)
  return rows.map((r) => ({
    targetType: r.targetType,
    eventCount: r.eventCount,
    percentage: total > 0 ? Math.round((r.eventCount / total) * 10000) / 100 : 0,
  }))
}

// ── UI ──────────────────────────────────────────────────────────────────────

export default async function AuditGraphPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; orgId?: string }>
}) {
  await requireRole('platform_admin', 'studio_admin', 'ops', 'analyst')

  const role = await getUserRole()
  const params = await searchParams
  const isExecutive = params.mode === 'executive'
  const isPlatformAdmin = role === 'platform_admin' || role === 'studio_admin'
  const orgId = isPlatformAdmin && !params.orgId ? null : params.orgId ?? null

  if (!isPlatformAdmin && !orgId) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900">Audit Graph</h1>
        <p className="text-gray-500 mt-4">
          Select an organization to view audit event chain.
        </p>
      </div>
    )
  }

  const [chain, density] = await Promise.all([
    getAuditChain(orgId),
    getCrossAppDensity(orgId),
  ])

  return (
    <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Audit Graph</h1>
        <p className="text-gray-500 mt-1">
          {orgId
            ? `Org-scoped audit chain — ${orgId}`
            : 'Global audit event chain — all orgs'}
        </p>
        <span className="inline-block mt-2 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
          Read-only visualization
        </span>
      </div>

      {/* Cross-app event density */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <ChartBarIcon className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Cross-App Event Density</h2>
        </div>
        {density.length > 0 ? (
          <div className="px-6 py-4 space-y-3">
            {density.map((d) => (
              <div key={d.targetType}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{d.targetType}</span>
                  <span className="text-xs text-gray-500">
                    {d.eventCount.toLocaleString()} events ({d.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 rounded-full h-2 transition-all"
                    style={{ width: `${Math.min(d.percentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-gray-400">
            No audit events found
          </div>
        )}
      </div>

      {/* Audit event chain with integrity hash */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <LinkIcon className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">
            Integrity Hash Chain
          </h2>
        </div>
        {chain.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {chain.map((entry, idx) => (
              <div key={entry.id} className="px-6 py-4 flex items-start gap-4">
                {/* Chain link indicator */}
                <div className="flex flex-col items-center mt-1">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  {idx < chain.length - 1 && (
                    <div className="w-0.5 h-8 bg-gray-200 mt-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {entry.action}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                      {entry.targetType}
                    </span>
                    {entry.actorRole && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600">
                        {entry.actorRole}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <FingerPrintIcon className="h-3 w-3" />
                      <code>{entry.integrityHash}</code>
                    </span>
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      {entry.createdAt.toISOString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-gray-400 flex flex-col items-center gap-2">
            <ShieldCheckIcon className="h-8 w-8" />
            <p>No audit events in scope</p>
          </div>
        )}
      </div>
    </div>
  )
}
