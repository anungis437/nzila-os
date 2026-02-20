/**
 * /console/ml/runs — ML Training & Inference Run History
 *
 * Unified log of all training and inference runs for this entity.
 */
import { db } from '@nzila/db'
import { mlModels, mlTrainingRuns, mlInferenceRuns } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const DEFAULT_ENTITY_ID = process.env.NZILA_DEFAULT_ENTITY_ID ?? ''

const ML_NAV = [
  { label: 'Overview', href: '/console/ml/overview' },
  { label: 'Models', href: '/console/ml/models' },
  { label: 'Runs', href: '/console/ml/runs' },
  { label: 'Stripe Daily', href: '/console/ml/stripe/daily' },
  { label: 'Stripe Transactions', href: '/console/ml/stripe/transactions' },
]

async function getRuns(entityId: string) {
  const [training, inference] = await Promise.all([
    db
      .select()
      .from(mlTrainingRuns)
      .where(eq(mlTrainingRuns.entityId, entityId))
      .orderBy(desc(mlTrainingRuns.startedAt))
      .limit(50),

    db
      .select({
        id: mlInferenceRuns.id,
        modelKey: mlModels.modelKey,
        modelId: mlInferenceRuns.modelId,
        status: mlInferenceRuns.status,
        startedAt: mlInferenceRuns.startedAt,
        finishedAt: mlInferenceRuns.finishedAt,
        inputPeriodStart: mlInferenceRuns.inputPeriodStart,
        inputPeriodEnd: mlInferenceRuns.inputPeriodEnd,
        summaryJson: mlInferenceRuns.summaryJson,
        error: mlInferenceRuns.error,
        createdAt: mlInferenceRuns.createdAt,
      })
      .from(mlInferenceRuns)
      .innerJoin(mlModels, eq(mlInferenceRuns.modelId, mlModels.id))
      .where(eq(mlInferenceRuns.entityId, entityId))
      .orderBy(desc(mlInferenceRuns.startedAt))
      .limit(50),
  ])

  return { training, inference }
}

export default async function MlRunsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const entityId = DEFAULT_ENTITY_ID
  const { training, inference } = await getRuns(entityId)

  return (
    <div className="p-6 space-y-6">
      {/* Section nav */}
      <div className="flex gap-4 border-b border-gray-200 pb-3">
        {ML_NAV.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-sm font-medium text-gray-600 hover:text-blue-600 transition"
          >
            {l.label}
          </Link>
        ))}
      </div>

      <h1 className="text-2xl font-bold text-gray-900">ML Run History</h1>

      {/* Training runs */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Training Runs
          <span className="ml-2 text-sm font-normal text-gray-400">(last 50)</span>
        </h2>
        {training.length === 0 ? (
          <p className="text-sm text-gray-500">No training runs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {['Model Key', 'Status', 'Rows', 'Started', 'Finished', 'Error'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {training.map((r) => (
                  <tr key={r.id} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{r.modelKey}</td>
                    <td className="px-4 py-2">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-2">{r.rowsProcessed ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {new Date(r.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {r.finishedAt ? new Date(r.finishedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-red-500 max-w-xs truncate">
                      {r.error ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Inference runs */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Inference Runs
          <span className="ml-2 text-sm font-normal text-gray-400">(last 50)</span>
        </h2>
        {inference.length === 0 ? (
          <p className="text-sm text-gray-500">No inference runs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {[
                    'Model Key',
                    'Status',
                    'Period',
                    'Total Rows',
                    'Anomalies',
                    'Started',
                    'Finished',
                  ].map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inference.map((r) => {
                  const summary =
                    r.summaryJson && typeof r.summaryJson === 'object'
                      ? (r.summaryJson as Record<string, unknown>)
                      : {}
                  return (
                    <tr key={r.id} className="bg-white hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs">{r.modelKey}</td>
                      <td className="px-4 py-2">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {r.inputPeriodStart} → {r.inputPeriodEnd}
                      </td>
                      <td className="px-4 py-2">{String(summary.totalRows ?? '—')}</td>
                      <td className="px-4 py-2 font-semibold text-amber-700">
                        {String(summary.anomalyCount ?? '—')}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {new Date(r.startedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {r.finishedAt ? new Date(r.finishedAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    started: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
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
