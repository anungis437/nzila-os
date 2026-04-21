import Link from 'next/link'
import { requireRole } from '@/lib/rbac'
import { platformDb } from '@nzila/db/platform'
import { automationCommands } from '@nzila/db/schema'
import { desc, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const STUCK_THRESHOLD_MINUTES = Number(process.env.ORCHESTRATOR_STUCK_THRESHOLD_MINUTES ?? 10)

function isDeadLettered(args: unknown): boolean {
  if (!args || typeof args !== 'object') return false
  const rawResult = (args as Record<string, unknown>).result
  if (!rawResult || typeof rawResult !== 'object') return false
  return Boolean((rawResult as Record<string, unknown>).deadLettered)
}

async function loadRuns() {
  const staleCutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60_000)
  const [recent, statusCounts] = await Promise.all([
    platformDb
      .select()
      .from(automationCommands)
      .orderBy(desc(automationCommands.updatedAt))
      .limit(300),
    platformDb
      .select({
        status: automationCommands.status,
        count: sql<number>`count(*)`,
      })
      .from(automationCommands)
      .groupBy(automationCommands.status),
  ])

  const activeRuns = recent.filter(
    (row) => row.status === 'pending' || row.status === 'dispatched' || row.status === 'running',
  )
  const failedRuns = recent.filter(
    (row) => row.status === 'failed' || isDeadLettered(row.args),
  )
  const stuckRuns = recent.filter(
    (row) => row.status === 'running' && row.updatedAt < staleCutoff,
  )

  const terminalWithLatency = recent
    .filter((row) => !!row.startedAt && !!row.completedAt)
    .map((row) => row.completedAt!.getTime() - row.startedAt!.getTime())
    .sort((a, b) => a - b)

  const p95LatencyMs = terminalWithLatency.length === 0
    ? 0
    : terminalWithLatency[Math.min(terminalWithLatency.length - 1, Math.floor(terminalWithLatency.length * 0.95))]

  const total = recent.length || 1
  const failed = failedRuns.length
  const retries = recent.reduce((sum, row) => sum + (row.attemptCount ?? 0), 0)

  return {
    activeRuns,
    failedRuns,
    stuckRuns,
    counts: statusCounts,
    metrics: {
      queueDepth: activeRuns.length,
      p95LatencyMs,
      failureRate: Math.round((failed / total) * 10_000) / 100,
      retries,
      stuckCount: stuckRuns.length,
    },
  }
}

function StatusPill({ status, deadLettered }: { status: string; deadLettered: boolean }) {
  if (deadLettered) {
    return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">dead_lettered</span>
  }

  const tone: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-700',
    dispatched: 'bg-blue-100 text-blue-700',
    running: 'bg-indigo-100 text-indigo-700',
    succeeded: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-rose-100 text-rose-700',
    cancelled: 'bg-amber-100 text-amber-700',
    approved: 'bg-cyan-100 text-cyan-700',
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}

function RunTable({
  title,
  description,
  rows,
}: {
  title: string
  description: string
  rows: Array<typeof automationCommands.$inferSelect>
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Run</th>
              <th className="px-4 py-3 font-medium">Org</th>
              <th className="px-4 py-3 font-medium">Workflow</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Version</th>
              <th className="px-4 py-3 font-medium">Retries</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium">Controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const deadLettered = isDeadLettered(row.args)
              return (
                <tr key={row.id} className="bg-white">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.id}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.orgId}</td>
                  <td className="px-4 py-3">{row.playbook}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={row.status} deadLettered={deadLettered} />
                  </td>
                  <td className="px-4 py-3">{row.version}</td>
                  <td className="px-4 py-3">{row.attemptCount}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{row.updatedAt.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        href={`/operator/orchestrator/${row.id}`}
                      >
                        Timeline
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                  No runs in this view.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default async function OrchestratorOperatorPage() {
  await requireRole('platform_admin', 'studio_admin')

  const data = await loadRuns()

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Orchestrator Operator</h1>
        <p className="mt-1 text-sm text-gray-500">
          Production execution control plane: live queue, failed/dead-letter runs, stuck detection, and timeline drill-down.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Queue Depth" value={String(data.metrics.queueDepth)} />
        <MetricCard label="p95 Latency" value={`${data.metrics.p95LatencyMs} ms`} />
        <MetricCard label="Failure Rate" value={`${data.metrics.failureRate}%`} />
        <MetricCard label="Retries" value={String(data.metrics.retries)} />
        <MetricCard label="Stuck Runs" value={String(data.metrics.stuckCount)} tone={data.metrics.stuckCount > 0 ? 'warn' : 'ok'} />
      </section>

      <RunTable
        title="Active Runs"
        description="Pending, queued, or running executions currently in-flight."
        rows={data.activeRuns}
      />

      <RunTable
        title="Failed Runs"
        description="Failed or dead-lettered runs requiring operator intervention."
        rows={data.failedRuns}
      />

      <RunTable
        title="Stuck Runs"
        description={`Running runs not updated for more than ${STUCK_THRESHOLD_MINUTES} minutes.`}
        rows={data.stuckRuns}
      />
    </div>
  )
}

function MetricCard({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' | 'ok' }) {
  const toneClass = tone === 'warn'
    ? 'border-amber-300 bg-amber-50'
    : tone === 'ok'
      ? 'border-emerald-300 bg-emerald-50'
      : 'border-gray-200 bg-white'

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}
