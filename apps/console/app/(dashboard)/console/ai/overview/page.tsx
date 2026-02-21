/**
 * /console/ai/overview — AI Engine Overview Dashboard
 *
 * Unified view of the Nzila AI Engine: request metrics, cost,
 * latency, action success rates, budget status, and refusal counts.
 */
import { platformDb } from '@nzila/db/platform'
import {
  aiRequests,
  aiActions,
  aiUsageBudgets,
  aiDeploymentRoutes,
  aiKnowledgeSources,
} from '@nzila/db/schema'
import { eq, desc, count, sum, avg } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const DEFAULT_ENTITY_ID = process.env.NZILA_DEFAULT_ENTITY_ID ?? ''

interface OverviewMetrics {
  totalRequests: number
  totalTokensIn: number
  totalTokensOut: number
  estimatedCostUsd: number
  avgLatencyMs: number
  successCount: number
  refusedCount: number
  failedCount: number
  requestsByApp: Array<{ appKey: string; count: number }>
  requestsByFeature: Array<{ feature: string; count: number }>
  actionSummary: {
    total: number
    executed: number
    failed: number
    pending: number
  }
  budgetSummary: Array<{
    appKey: string
    profileKey: string
    month: string
    budgetUsd: string
    spentUsd: string
    status: string
  }>
  deploymentRouteCount: number
  knowledgeSourceCount: number
}

async function getOverviewMetrics(entityId: string): Promise<OverviewMetrics> {
  // Request metrics
  const requestStats = await platformDb
    .select({
      total: count(),
      tokensIn: sum(aiRequests.tokensIn),
      tokensOut: sum(aiRequests.tokensOut),
      costUsd: sum(aiRequests.costUsd),
      avgLatency: avg(aiRequests.latencyMs),
    })
    .from(aiRequests)
    .where(eq(aiRequests.entityId, entityId))

  const stats = requestStats[0] ?? { total: 0, tokensIn: '0', tokensOut: '0', costUsd: '0', avgLatency: '0' }

  // Request status breakdown
  const statusCounts = await platformDb
    .select({
      status: aiRequests.status,
      count: count(),
    })
    .from(aiRequests)
    .where(eq(aiRequests.entityId, entityId))
    .groupBy(aiRequests.status)

  const statusMap: Record<string, number> = {}
  for (const s of statusCounts) {
    statusMap[s.status] = s.count
  }

  // Requests by appKey
  const byApp = await platformDb
    .select({
      appKey: aiRequests.appKey,
      count: count(),
    })
    .from(aiRequests)
    .where(eq(aiRequests.entityId, entityId))
    .groupBy(aiRequests.appKey)
    .orderBy(desc(count()))
    .limit(10)

  // Requests by feature
  const byFeature = await platformDb
    .select({
      feature: aiRequests.feature,
      count: count(),
    })
    .from(aiRequests)
    .where(eq(aiRequests.entityId, entityId))
    .groupBy(aiRequests.feature)
    .orderBy(desc(count()))

  // Action summary
  const allActions = await platformDb
    .select({
      status: aiActions.status,
      count: count(),
    })
    .from(aiActions)
    .where(eq(aiActions.entityId, entityId))
    .groupBy(aiActions.status)

  let actionTotal = 0
  let actionExecuted = 0
  let actionFailed = 0
  let actionPending = 0
  for (const a of allActions) {
    actionTotal += a.count
    if (a.status === 'executed') actionExecuted = a.count
    else if (a.status === 'failed') actionFailed = a.count
    else if (['proposed', 'policy_checked', 'awaiting_approval', 'approved', 'executing'].includes(a.status)) {
      actionPending += a.count
    }
  }

  // Budget summary
  const budgets = await platformDb
    .select()
    .from(aiUsageBudgets)
    .where(eq(aiUsageBudgets.entityId, entityId))
    .orderBy(desc(aiUsageBudgets.month))
    .limit(10)

  const budgetSummary = budgets.map((b) => ({
    appKey: b.appKey,
    profileKey: b.profileKey,
    month: b.month,
    budgetUsd: b.budgetUsd,
    spentUsd: b.spentUsd,
    status: b.status,
  }))

  // Deployment route count
  const [routeCount] = await platformDb
    .select({ count: count() })
    .from(aiDeploymentRoutes)
    .where(eq(aiDeploymentRoutes.entityId, entityId))

  // Knowledge source count
  const [ksCount] = await platformDb
    .select({ count: count() })
    .from(aiKnowledgeSources)
    .where(eq(aiKnowledgeSources.entityId, entityId))

  return {
    totalRequests: stats.total,
    totalTokensIn: Number(stats.tokensIn ?? 0),
    totalTokensOut: Number(stats.tokensOut ?? 0),
    estimatedCostUsd: Number(stats.costUsd ?? 0),
    avgLatencyMs: Math.round(Number(stats.avgLatency ?? 0)),
    successCount: statusMap['success'] ?? 0,
    refusedCount: statusMap['refused'] ?? 0,
    failedCount: statusMap['failed'] ?? 0,
    requestsByApp: byApp.map((r) => ({ appKey: r.appKey, count: r.count })),
    requestsByFeature: byFeature.map((r) => ({ feature: r.feature, count: r.count })),
    actionSummary: {
      total: actionTotal,
      executed: actionExecuted,
      failed: actionFailed,
      pending: actionPending,
    },
    budgetSummary,
    deploymentRouteCount: routeCount?.count ?? 0,
    knowledgeSourceCount: ksCount?.count ?? 0,
  }
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

export default async function AiOverviewPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!DEFAULT_ENTITY_ID) {
    return <div className="p-8 text-red-600">NZILA_DEFAULT_ENTITY_ID not configured</div>
  }

  const m = await getOverviewMetrics(DEFAULT_ENTITY_ID)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Engine Overview</h1>
        <div className="flex gap-2 text-sm">
          <Link href="/console/ai/models" className="rounded-md bg-muted px-3 py-1.5 hover:bg-muted/80">
            Models
          </Link>
          <Link href="/console/ai/usage" className="rounded-md bg-muted px-3 py-1.5 hover:bg-muted/80">
            Usage
          </Link>
          <Link href="/console/ai/actions" className="rounded-md bg-muted px-3 py-1.5 hover:bg-muted/80">
            Actions
          </Link>
          <Link href="/console/ai/knowledge" className="rounded-md bg-muted px-3 py-1.5 hover:bg-muted/80">
            Knowledge
          </Link>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Requests" value={formatNumber(m.totalRequests)} />
        <StatCard label="Tokens In / Out" value={`${formatNumber(m.totalTokensIn)} / ${formatNumber(m.totalTokensOut)}`} />
        <StatCard label="Estimated Cost" value={formatCost(m.estimatedCostUsd)} />
        <StatCard label="Avg Latency" value={`${m.avgLatencyMs}ms`} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Success" value={formatNumber(m.successCount)} color="text-green-600" />
        <StatCard label="Refused / Policy" value={formatNumber(m.refusedCount)} color="text-amber-600" />
        <StatCard label="Failed" value={formatNumber(m.failedCount)} color="text-red-600" />
        <StatCard label="Deployment Routes" value={formatNumber(m.deploymentRouteCount)} />
      </div>

      {/* ── Requests by App ────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Requests by App</h2>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">App</th>
                  <th className="px-4 py-2 text-right font-medium">Requests</th>
                </tr>
              </thead>
              <tbody>
                {m.requestsByApp.map((r) => (
                  <tr key={r.appKey} className="border-b">
                    <td className="px-4 py-2 font-mono text-xs">{r.appKey}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(r.count)}</td>
                  </tr>
                ))}
                {m.requestsByApp.length === 0 && (
                  <tr><td colSpan={2} className="px-4 py-4 text-center text-muted-foreground">No requests yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Requests by Feature</h2>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Feature</th>
                  <th className="px-4 py-2 text-right font-medium">Requests</th>
                </tr>
              </thead>
              <tbody>
                {m.requestsByFeature.map((r) => (
                  <tr key={r.feature} className="border-b">
                    <td className="px-4 py-2 font-mono text-xs">{r.feature}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(r.count)}</td>
                  </tr>
                ))}
                {m.requestsByFeature.length === 0 && (
                  <tr><td colSpan={2} className="px-4 py-4 text-center text-muted-foreground">No requests yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── Actions Summary ────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Actions</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Actions" value={formatNumber(m.actionSummary.total)} />
          <StatCard label="Executed" value={formatNumber(m.actionSummary.executed)} color="text-green-600" />
          <StatCard label="Failed" value={formatNumber(m.actionSummary.failed)} color="text-red-600" />
          <StatCard label="Pending" value={formatNumber(m.actionSummary.pending)} color="text-amber-600" />
        </div>
      </section>

      {/* ── Budget Status ──────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Budget Status</h2>
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">App / Profile</th>
                <th className="px-4 py-2 text-left font-medium">Month</th>
                <th className="px-4 py-2 text-right font-medium">Budget</th>
                <th className="px-4 py-2 text-right font-medium">Spent</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {m.budgetSummary.map((b, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-2 font-mono text-xs">{b.appKey}/{b.profileKey}</td>
                  <td className="px-4 py-2 text-xs">{b.month}</td>
                  <td className="px-4 py-2 text-right">${Number(b.budgetUsd).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">${Number(b.spentUsd).toFixed(4)}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      b.status === 'ok' ? 'bg-green-100 text-green-800'
                        : b.status === 'warning' ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
              {m.budgetSummary.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">No budgets configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Knowledge Sources ──────────────────────────────────── */}
      <section className="rounded-lg border bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Knowledge Sources</span>
          <span className="text-2xl font-bold">{m.knowledgeSourceCount}</span>
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color ?? ''}`}>{value}</div>
    </div>
  )
}
