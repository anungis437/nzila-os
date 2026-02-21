/**
 * /console/ai/usage — AI Usage Analytics
 *
 * Detailed request-level usage analytics with filtering by appKey,
 * feature, and time range. Shows tokens, cost, latency percentiles.
 */
import { platformDb } from '@nzila/db/platform'
import { aiRequests } from '@nzila/db/schema'
import { eq, desc, and, count, sum, avg } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const DEFAULT_ENTITY_ID = process.env.NZILA_DEFAULT_ENTITY_ID ?? ''

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

async function getUsageData(entityId: string) {
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
    .where(eq(aiRequests.entityId, entityId))
    .groupBy(aiRequests.appKey, aiRequests.profileKey, aiRequests.feature)
    .orderBy(desc(count()))

  // Refusal counts by appKey + profileKey
  const refusals = await platformDb
    .select({
      appKey: aiRequests.appKey,
      profileKey: aiRequests.profileKey,
      count: count(),
    })
    .from(aiRequests)
    .where(and(eq(aiRequests.entityId, entityId), eq(aiRequests.status, 'refused')))
    .groupBy(aiRequests.appKey, aiRequests.profileKey)

  const refusalMap = new Map<string, number>()
  for (const r of refusals) {
    refusalMap.set(`${r.appKey}::${r.profileKey}`, r.count)
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
    refusedCount: refusalMap.get(`${r.appKey}::${r.profileKey}`) ?? 0,
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
    .where(eq(aiRequests.entityId, entityId))
    .orderBy(desc(aiRequests.occurredAt))
    .limit(25)

  return { usage, recent }
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  refused: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
}

export default async function AiUsagePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!DEFAULT_ENTITY_ID) {
    return <div className="p-8 text-red-600">NZILA_DEFAULT_ENTITY_ID not configured</div>
  }

  const { usage, recent } = await getUsageData(DEFAULT_ENTITY_ID)

  const totalCost = usage.reduce((s, u) => s + u.costUsd, 0)
  const totalTokens = usage.reduce((s, u) => s + u.tokensIn + u.tokensOut, 0)
  const totalRefused = usage.reduce((s, u) => s + u.refusedCount, 0)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">AI Usage Analytics</h1>

      {/* ── Totals ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Cost</div>
          <div className="mt-1 text-2xl font-bold">${totalCost.toFixed(4)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Tokens</div>
          <div className="mt-1 text-2xl font-bold">{totalTokens.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Refusals</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{totalRefused}</div>
        </div>
      </div>

      {/* ── Usage by App / Profile / Feature ───────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Usage Breakdown</h2>
        <div className="rounded-lg border overflow-x-auto">
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

      {/* ── Recent Requests ────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent Requests</h2>
        <div className="rounded-lg border overflow-x-auto">
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
    </div>
  )
}
