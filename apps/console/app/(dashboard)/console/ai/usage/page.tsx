/**
 * /console/ai/usage — AI Usage Analytics
 *
 * Detailed request-level usage analytics with filtering by appKey,
 * feature, and time range. Shows tokens, cost, latency percentiles.
 */
import { platformDb } from '@nzila/db/platform'
import { aiRequests } from '@nzila/db/schema'
import { eq, desc, and, count, sum, avg, sql } from 'drizzle-orm'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveConsoleEntityId } from '@/lib/entity-context'

export const dynamic = 'force-dynamic'

interface UsageRow {
  appKey: string
  profileKey: string
  feature: string
  requestCount: number
  tokensIn: number
  tokensOut: number
  costUsd: number
  avgLatencyMs: number
  refusedCount: number
}

interface ClientAttributedUsageRow {
  clientOrgId: string
  appKey: string
  requestCount: number
  costUsd: number
  lastOccurredAt: Date | null
}

async function getUsageData(orgId: string) {
  // Aggregate usage by appKey + profileKey + feature
  const rows = await platformDb
    .select({
      appKey: aiRequests.appKey,
      profileKey: aiRequests.profileKey,
      feature: aiRequests.feature,
      requestCount: count(),
      tokensIn: sum(aiRequests.tokensIn),
      tokensOut: sum(aiRequests.tokensOut),
      costUsd: sum(aiRequests.costUsd),
      avgLatency: avg(aiRequests.latencyMs),
    })
    .from(aiRequests)
    .where(eq(aiRequests.orgId, orgId))
    .groupBy(aiRequests.appKey, aiRequests.profileKey, aiRequests.feature)
    .orderBy(desc(count()))

  // Refusal counts by appKey + profileKey + feature (avoid double counting in totals)
  const refusals = await platformDb
    .select({
      appKey: aiRequests.appKey,
      profileKey: aiRequests.profileKey,
      feature: aiRequests.feature,
      count: count(),
    })
    .from(aiRequests)
    .where(and(eq(aiRequests.orgId, orgId), eq(aiRequests.status, 'refused')))
    .groupBy(aiRequests.appKey, aiRequests.profileKey, aiRequests.feature)

  const refusalMap = new Map<string, number>()
  for (const r of refusals) {
    refusalMap.set(`${r.appKey}::${r.profileKey}::${r.feature}`, r.count)
  }

  const usage: UsageRow[] = rows.map((r) => ({
    appKey: r.appKey,
    profileKey: r.profileKey,
    feature: r.feature,
    requestCount: r.requestCount,
    tokensIn: Number(r.tokensIn ?? 0),
    tokensOut: Number(r.tokensOut ?? 0),
    costUsd: Number(r.costUsd ?? 0),
    avgLatencyMs: Math.round(Number(r.avgLatency ?? 0)),
    refusedCount: refusalMap.get(`${r.appKey}::${r.profileKey}::${r.feature}`) ?? 0,
  }))

  // Recent requests (last 25)
  const recent = await platformDb
    .select({
      id: aiRequests.id,
      appKey: aiRequests.appKey,
      profileKey: aiRequests.profileKey,
      feature: aiRequests.feature,
      provider: aiRequests.provider,
      modelOrDeployment: aiRequests.modelOrDeployment,
      tokensIn: aiRequests.tokensIn,
      tokensOut: aiRequests.tokensOut,
      costUsd: aiRequests.costUsd,
      latencyMs: aiRequests.latencyMs,
      status: aiRequests.status,
      errorCode: aiRequests.errorCode,
      occurredAt: aiRequests.occurredAt,
    })
    .from(aiRequests)
    .where(eq(aiRequests.orgId, orgId))
    .orderBy(desc(aiRequests.occurredAt))
    .limit(25)

  const clientAttributedRaw = await platformDb.execute(sql`
    SELECT
      after_json->>'domainId' AS "clientOrgId",
      after_json->>'appKey' AS "appKey",
      COUNT(*)::int AS "requestCount",
      COALESCE(SUM(COALESCE(NULLIF(after_json->>'costUsd', ''), '0')::numeric), 0)::text AS "costUsd",
      MAX(created_at) AS "lastOccurredAt"
    FROM audit_events
    WHERE org_id = ${orgId}::uuid
      AND action = 'ai.request_executed'
      AND after_json->>'domainType' = 'organization'
      AND COALESCE(after_json->>'domainId', '') <> ''
    GROUP BY 1, 2
    ORDER BY MAX(created_at) DESC
    LIMIT 25
  `)

  const clientAttributedUsage: ClientAttributedUsageRow[] = (clientAttributedRaw as Array<Record<string, unknown>>).map((row) => ({
    clientOrgId: String(row.clientOrgId ?? ''),
    appKey: String(row.appKey ?? ''),
    requestCount: Number(row.requestCount ?? 0),
    costUsd: Number(row.costUsd ?? 0),
    lastOccurredAt: row.lastOccurredAt instanceof Date
      ? row.lastOccurredAt
      : typeof row.lastOccurredAt === 'string'
        ? new Date(row.lastOccurredAt)
        : null,
  }))

  return { usage, recent, clientAttributedUsage }
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  refused: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
}

export default async function AiUsagePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const orgId = await resolveConsoleEntityId(userId)
  if (!orgId) {
    return <div className="p-8 text-red-600">No active org membership or fallback entity configured</div>
  }

  const { usage, recent, clientAttributedUsage } = await getUsageData(orgId)

  const totalCost = usage.reduce((s, u) => s + u.costUsd, 0)
  const totalTokens = usage.reduce((s, u) => s + u.tokensIn + u.tokensOut, 0)
  const totalRefused = usage.reduce((s, u) => s + u.refusedCount, 0)
  const totalRequests = usage.reduce((s, u) => s + u.requestCount, 0)
  const avgLatency = totalRequests > 0
    ? Math.round(usage.reduce((s, u) => s + (u.avgLatencyMs * u.requestCount), 0) / totalRequests)
    : 0
  const refusalRate = totalRequests > 0 ? ((totalRefused / totalRequests) * 100) : 0

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-2 pb-8 sm:px-4">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-linear-to-br from-card via-card to-muted/40 p-6 shadow-sm">
        <div className="absolute -left-8 top-10 h-28 w-28 rounded-full bg-blue-500/10 blur-2xl" />
        <div className="absolute -right-8 bottom-0 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Console / AI</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">AI Usage Analytics</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Track request volume, token spend, refusal posture, and latency by app, profile, and feature.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/console/ai/overview" className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted/80">
              Overview
            </Link>
            <Link href="/console/ai/models" className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted/80">
              Models
            </Link>
            <Link href="/console/ai/actions" className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted/80">
              Actions
            </Link>
            <Link href="/console/ai/knowledge" className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted/80">
              Knowledge
            </Link>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Requests" value={String(totalRequests)} tone="blue" />
          <StatCard label="Total Cost" value={`$${totalCost.toFixed(4)}`} tone="emerald" />
          <StatCard label="Refusal Rate" value={`${refusalRate.toFixed(1)}%`} tone="amber" />
          <StatCard label="Avg Latency" value={`${avgLatency}ms`} tone="violet" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold tracking-tight">Usage Breakdown</h2>
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">App / Profile</th>
                <th className="px-4 py-3 text-left font-medium">Feature</th>
                <th className="px-4 py-3 text-right font-medium">Requests</th>
                <th className="px-4 py-3 text-right font-medium">Tokens In</th>
                <th className="px-4 py-3 text-right font-medium">Tokens Out</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 text-right font-medium">Avg Latency</th>
                <th className="px-4 py-3 text-right font-medium">Refusals</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((u, i) => (
                <tr key={i} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{u.appKey}/{u.profileKey}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                      {u.feature}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{u.requestCount}</td>
                  <td className="px-4 py-3 text-right">{u.tokensIn.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{u.tokensOut.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">${u.costUsd.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right">{u.avgLatencyMs}ms</td>
                  <td className="px-4 py-3 text-right">{u.refusedCount > 0 ? <span className="text-amber-600">{u.refusedCount}</span> : '0'}</td>
                </tr>
              ))}
              {usage.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">No usage data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold tracking-tight">Recent Requests</h2>
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Time</th>
                <th className="px-3 py-2 text-left font-medium">App</th>
                <th className="px-3 py-2 text-left font-medium">Feature</th>
                <th className="px-3 py-2 text-left font-medium">Model</th>
                <th className="px-3 py-2 text-right font-medium">In</th>
                <th className="px-3 py-2 text-right font-medium">Out</th>
                <th className="px-3 py-2 text-right font-medium">Cost</th>
                <th className="px-3 py-2 text-right font-medium">Latency</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30 text-xs">
                  <td className="px-3 py-2 text-muted-foreground">{r.occurredAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
                  <td className="px-3 py-2 font-mono">{r.appKey}</td>
                  <td className="px-3 py-2">{r.feature}</td>
                  <td className="px-3 py-2 font-mono">{r.modelOrDeployment}</td>
                  <td className="px-3 py-2 text-right">{r.tokensIn ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{r.tokensOut ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{r.costUsd ? `$${Number(r.costUsd).toFixed(4)}` : '—'}</td>
                  <td className="px-3 py-2 text-right">{r.latencyMs ?? '—'}ms</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-100'}`}>
                      {r.status}
                    </span>
                    {r.errorCode && <span className="ml-1 text-red-500">{r.errorCode}</span>}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">No requests yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold tracking-tight">Client-Attributed Activity</h2>
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Client Org</th>
                <th className="px-4 py-3 text-left font-medium">App</th>
                <th className="px-4 py-3 text-right font-medium">Requests</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 text-left font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {clientAttributedUsage.map((row) => (
                <tr key={`${row.appKey}:${row.clientOrgId}`} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{row.clientOrgId}</td>
                  <td className="px-4 py-3 text-xs">{row.appKey}</td>
                  <td className="px-4 py-3 text-right">{row.requestCount}</td>
                  <td className="px-4 py-3 text-right">${row.costUsd.toFixed(4)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {row.lastOccurredAt ? row.lastOccurredAt.toISOString().slice(0, 19).replace('T', ' ') : '—'}
                  </td>
                </tr>
              ))}
              {clientAttributedUsage.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No client-attributed AI activity yet. New Union Eyes requests will appear here once traced traffic lands.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Token Posture</h3>
          <p className="mt-2 text-sm text-muted-foreground">Combined tokens in/out across grouped features.</p>
          <p className="mt-3 text-2xl font-bold">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Refusals</h3>
          <p className="mt-2 text-sm text-muted-foreground">Safety and policy refusals in aggregate.</p>
          <p className="mt-3 text-2xl font-bold text-amber-600">{totalRefused}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Average Latency</h3>
          <p className="mt-2 text-sm text-muted-foreground">Weighted by request volume per feature group.</p>
          <p className="mt-3 text-2xl font-bold">{avgLatency}ms</p>
        </div>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'amber' | 'blue' | 'emerald' | 'violet'
}) {
  const tones: Record<typeof tone, string> = {
    amber: 'border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300',
    blue: 'border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
    violet: 'border-violet-500/20 bg-violet-500/5 text-violet-700 dark:text-violet-300',
  }

  return (
    <div className={`rounded-xl border px-4 py-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
    </div>
  )
}
