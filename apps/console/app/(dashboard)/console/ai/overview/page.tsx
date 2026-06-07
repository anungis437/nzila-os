/**
 * /console/ai/overview — Governance Intelligence Substrate Overview
 *
 * Operational view of the Nzila institutional cognition substrate:
 * request cadence, cost posture, interpretation latency, action confirmation
 * rates, budget status, and refusal audit counts.
 *
 * Operators govern this substrate; it does not govern operators.
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
import { auth } from '@nzila/platform-auth/entra/server'
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

const EMPTY_OVERVIEW_METRICS: OverviewMetrics = {
  totalRequests: 0,
  totalTokensIn: 0,
  totalTokensOut: 0,
  estimatedCostUsd: 0,
  avgLatencyMs: 0,
  successCount: 0,
  refusedCount: 0,
  failedCount: 0,
  requestsByApp: [],
  requestsByFeature: [],
  actionSummary: {
    total: 0,
    executed: 0,
    failed: 0,
    pending: 0,
  },
  budgetSummary: [],
  deploymentRouteCount: 0,
  knowledgeSourceCount: 0,
}

function isMissingDbObjectError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybePg = error as { code?: string; message?: string }
  if (maybePg.code === '42P01' || maybePg.code === '42703') return true
  return typeof maybePg.message === 'string' && maybePg.message.toLowerCase().includes('does not exist')
}

async function safeQuery<T>(
  label: string,
  query: Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await query
  } catch (error) {
    if (isMissingDbObjectError(error)) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[console.ai.overview] ${label} unavailable; falling back (${message})`)
      return fallback
    }
    throw error
  }
}

async function getOverviewMetrics(orgId: string): Promise<OverviewMetrics> {
  // Request metrics
  const requestStats = await safeQuery(
    'request stats query',
    platformDb
      .select({
        total: count(),
        tokensIn: sum(aiRequests.tokensIn),
        tokensOut: sum(aiRequests.tokensOut),
        costUsd: sum(aiRequests.costUsd),
        avgLatency: avg(aiRequests.latencyMs),
      })
      .from(aiRequests)
      .where(eq(aiRequests.orgId, orgId)),
    [],
  )

  const stats = requestStats[0] ?? { total: 0, tokensIn: '0', tokensOut: '0', costUsd: '0', avgLatency: '0' }

  // Request status breakdown
  const statusCounts = await safeQuery(
    'request status breakdown query',
    platformDb
      .select({
        status: aiRequests.status,
        count: count(),
      })
      .from(aiRequests)
      .where(eq(aiRequests.orgId, orgId))
      .groupBy(aiRequests.status),
    [],
  )

  const statusMap: Record<string, number> = {}
  for (const s of statusCounts) {
    statusMap[s.status] = s.count
  }

  // Requests by appKey
  const byApp = await safeQuery(
    'requests by app query',
    platformDb
      .select({
        appKey: aiRequests.appKey,
        count: count(),
      })
      .from(aiRequests)
      .where(eq(aiRequests.orgId, orgId))
      .groupBy(aiRequests.appKey)
      .orderBy(desc(count()))
      .limit(10),
    [],
  )

  // Requests by feature
  const byFeature = await safeQuery(
    'requests by feature query',
    platformDb
      .select({
        feature: aiRequests.feature,
        count: count(),
      })
      .from(aiRequests)
      .where(eq(aiRequests.orgId, orgId))
      .groupBy(aiRequests.feature)
      .orderBy(desc(count())),
    [],
  )

  // Action summary
  const allActions = await safeQuery(
    'action summary query',
    platformDb
      .select({
        status: aiActions.status,
        count: count(),
      })
      .from(aiActions)
      .where(eq(aiActions.orgId, orgId))
      .groupBy(aiActions.status),
    [],
  )

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
  const budgets = await safeQuery(
    'budget summary query',
    platformDb
      .select()
      .from(aiUsageBudgets)
      .where(eq(aiUsageBudgets.orgId, orgId))
      .orderBy(desc(aiUsageBudgets.month))
      .limit(10),
    [],
  )

  const budgetSummary = budgets.map((b) => ({
    appKey: b.appKey,
    profileKey: b.profileKey,
    month: b.month,
    budgetUsd: b.budgetUsd,
    spentUsd: b.spentUsd,
    status: b.status,
  }))

  // Deployment route count
  const [routeCount] = await safeQuery(
    'deployment route count query',
    platformDb
      .select({ count: count() })
      .from(aiDeploymentRoutes)
      .where(eq(aiDeploymentRoutes.orgId, orgId)),
    [],
  )

  // Knowledge source count
  const [ksCount] = await safeQuery(
    'knowledge source count query',
    platformDb
      .select({ count: count() })
      .from(aiKnowledgeSources)
      .where(eq(aiKnowledgeSources.orgId, orgId)),
    [],
  )

  return {
    ...EMPTY_OVERVIEW_METRICS,
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
    <div className="mx-auto max-w-7xl space-y-8 px-2 pb-8 sm:px-4">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-linear-to-br from-card via-card to-muted/40 p-6 shadow-sm">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
        <div className="absolute -bottom-12 left-24 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Console / AI</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">AI Engine Overview</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Live operational view of requests, costs, safety outcomes, model actions, and monthly budget controls.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/console/ai/models" className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted/80">
              Models
            </Link>
            <Link href="/console/ai/usage" className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted/80">
              Usage
            </Link>
            <Link href="/console/ai/actions" className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted/80">
              Actions
            </Link>
            <Link href="/console/ai/knowledge" className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted/80">
              Knowledge
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Traffic and Cost</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Requests" value={formatNumber(m.totalRequests)} />
          <StatCard label="Tokens In / Out" value={`${formatNumber(m.totalTokensIn)} / ${formatNumber(m.totalTokensOut)}`} />
          <StatCard label="Estimated Cost" value={formatCost(m.estimatedCostUsd)} />
          <StatCard label="Avg Latency" value={`${m.avgLatencyMs}ms`} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Reliability and Control</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Success" value={formatNumber(m.successCount)} color="text-emerald-600" />
          <StatCard label="Refused / Policy" value={formatNumber(m.refusedCount)} color="text-amber-600" />
          <StatCard label="Failed" value={formatNumber(m.failedCount)} color="text-red-600" />
          <StatCard label="Deployment Routes" value={formatNumber(m.deploymentRouteCount)} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold tracking-tight">Action Pipeline</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatChip label="Total" value={formatNumber(m.actionSummary.total)} />
            <StatChip label="Executed" value={formatNumber(m.actionSummary.executed)} tone="green" />
            <StatChip label="Failed" value={formatNumber(m.actionSummary.failed)} tone="red" />
            <StatChip label="Pending" value={formatNumber(m.actionSummary.pending)} tone="amber" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold tracking-tight">Operational Snapshot</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Knowledge sources</dt>
              <dd className="font-semibold">{formatNumber(m.knowledgeSourceCount)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Pending actions</dt>
              <dd className="font-semibold">{formatNumber(m.actionSummary.pending)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Failure ratio</dt>
              <dd className="font-semibold">
                {m.totalRequests > 0 ? `${((m.failedCount / m.totalRequests) * 100).toFixed(1)}%` : '0.0%'}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold tracking-tight">Requests by App</h2>
          <div className="overflow-hidden rounded-xl border">
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

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold tracking-tight">Requests by Feature</h2>
          <div className="overflow-hidden rounded-xl border">
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

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold tracking-tight">Budget Status</h2>
        <div className="overflow-hidden rounded-xl border">
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
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color ?? ''}`}>{value}</div>
    </div>
  )
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'green' | 'amber' | 'red'
}) {
  const toneClasses =
    tone === 'green'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'red'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-border bg-muted/30 text-foreground'

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClasses}`}>
      <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}
