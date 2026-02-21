/**
 * /console/ml/overview — ML Subsystem Overview
 *
 * Summary cards: active models, last training runs, recent anomaly
 * counts for both Stripe tracks. Entry point for the ML section.
 *
 * Dogfoods @nzila/ml-sdk — zero direct DB access.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { mlClient, getEntityId } from '@/lib/ml-server'

export const dynamic = 'force-dynamic'

async function getMlOverview(entityId: string) {
  const ml = mlClient()

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const startDate = ninetyDaysAgo.toISOString().slice(0, 10)
  const endDate = new Date().toISOString().slice(0, 10)

  const [activeModels, recentTraining, recentInference, dailyScores, txnResult] =
    await Promise.all([
      ml.getActiveModels(entityId),
      ml.getTrainingRuns(entityId, 5),
      ml.getInferenceRuns(entityId, 5),
      ml.getStripeDailyScores({ entityId, startDate, endDate }),
      ml.getStripeTxnScores({ entityId, startDate, endDate, isAnomaly: true, limit: 500 }),
    ])

  const dailyAnomalyCount = dailyScores.filter((s) => s.isAnomaly).length
  const txnAnomalyCount = txnResult.anomalyInPeriod

  return { activeModels, recentTraining, recentInference, dailyAnomalyCount, txnAnomalyCount }
}

export default async function MlOverviewPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const entityId = getEntityId()
  const { activeModels, recentTraining, recentInference, dailyAnomalyCount, txnAnomalyCount } =
    await getMlOverview(entityId)

  const mlNavLinks = [
    { label: 'Overview', href: '/console/ml/overview' },
    { label: 'Models', href: '/console/ml/models' },
    { label: 'Runs', href: '/console/ml/runs' },
    { label: 'Stripe Daily', href: '/console/ml/stripe/daily' },
    { label: 'Stripe Transactions', href: '/console/ml/stripe/transactions' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Section nav */}
      <div className="flex gap-4 border-b border-gray-200 pb-3">
        {mlNavLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-sm font-medium text-gray-600 hover:text-blue-600 transition"
          >
            {l.label}
          </Link>
        ))}
      </div>

      <h1 className="text-2xl font-bold text-gray-900">ML Overview</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active Models" value={String(activeModels.length)} />
        <StatCard label="Total Daily Anomalies" value={String(dailyAnomalyCount)} color="amber" />
        <StatCard label="Total Txn Anomalies" value={String(txnAnomalyCount)} color="red" />
        <StatCard label="Recent Inference Runs" value={String(recentInference.length)} />
      </div>

      {/* Active models */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Active Models</h2>
        {activeModels.length === 0 ? (
          <p className="text-sm text-gray-500">No active models. Train a model to get started.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {['Model Key', 'Version', 'Status', 'Approved At'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeModels.map((m) => (
                  <tr key={m.id} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{m.modelKey}</td>
                    <td className="px-4 py-2">{m.version}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {m.meta.approvedAt ? new Date(m.meta.approvedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent training runs */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Recent Training Runs</h2>
        <RunTable
          runs={recentTraining.map((r) => ({
            id: r.id,
            modelKey: r.modelKey,
            status: r.status,
            startedAt: r.startedAt,
            finishedAt: r.finishedAt ?? null,
            rowsProcessed: r.rowsProcessed ?? null,
          }))}
        />
      </section>

      {/* Recent inference runs */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Recent Inference Runs</h2>
        <RunTable
          runs={recentInference.map((r) => ({
            id: r.id,
            modelKey: r.modelKey,
            status: r.status,
            startedAt: r.startedAt,
            finishedAt: r.finishedAt ?? null,
            rowsProcessed:
              r.summaryJson && typeof r.summaryJson === 'object' && 'totalRows' in r.summaryJson
                ? Number((r.summaryJson as Record<string, unknown>).totalRows)
                : null,
          }))}
        />
      </section>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = 'blue',
}: {
  label: string
  value: string
  color?: 'blue' | 'amber' | 'red' | 'green'
}) {
  const ring: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    green: 'border-green-200 bg-green-50 text-green-900',
  }
  return (
    <div className={`rounded-xl border p-4 ${ring[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-60">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  )
}

function RunTable({
  runs,
}: {
  runs: {
    id: string
    modelKey: string
    status: string
    startedAt: string
    finishedAt: string | null
    rowsProcessed: number | null
  }[]
}) {
  if (runs.length === 0)
    return <p className="text-sm text-gray-500">No runs recorded yet.</p>

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            {['Model Key', 'Status', 'Rows', 'Started', 'Finished'].map((h) => (
              <th key={h} className="px-4 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {runs.map((r) => (
            <tr key={r.id} className="bg-white hover:bg-gray-50">
              <td className="px-4 py-2 font-mono text-xs">{r.modelKey}</td>
              <td className="px-4 py-2">
                <StatusPill status={r.status} />
              </td>
              <td className="px-4 py-2">{r.rowsProcessed ?? '—'}</td>
              <td className="px-4 py-2 text-gray-500">
                {new Date(r.startedAt).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-gray-500">
                {r.finishedAt ? new Date(r.finishedAt).toLocaleString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    started: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    active: 'bg-green-100 text-green-800',
    draft: 'bg-gray-100 text-gray-700',
    retired: 'bg-yellow-100 text-yellow-800',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        map[status] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {status}
    </span>
  )
}
