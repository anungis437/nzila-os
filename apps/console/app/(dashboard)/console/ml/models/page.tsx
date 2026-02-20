/**
 * /console/ml/models — ML Model Registry
 *
 * Shows all versions of every model for this entity.
 * Active/retire actions are entity_admin only (shown server-side
 * based on role; actual mutations go through API routes).
 */
import { db } from '@nzila/db'
import { mlModels, mlDatasets, documents } from '@nzila/db/schema'
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

async function getModels(entityId: string) {
  return db
    .select({
      id: mlModels.id,
      modelKey: mlModels.modelKey,
      algorithm: mlModels.algorithm,
      version: mlModels.version,
      status: mlModels.status,
      approvedBy: mlModels.approvedBy,
      approvedAt: mlModels.approvedAt,
      createdAt: mlModels.createdAt,
      hyperparamsJson: mlModels.hyperparamsJson,
      trainingDatasetId: mlModels.trainingDatasetId,
    })
    .from(mlModels)
    .where(eq(mlModels.entityId, entityId))
    .orderBy(desc(mlModels.createdAt))
}

export default async function MlModelsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const entityId = DEFAULT_ENTITY_ID
  const models = await getModels(entityId)

  const byKey: Record<string, typeof models> = {}
  for (const m of models) {
    if (!byKey[m.modelKey]) byKey[m.modelKey] = []
    byKey[m.modelKey].push(m)
  }

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

      <h1 className="text-2xl font-bold text-gray-900">ML Model Registry</h1>
      <p className="text-sm text-gray-500">
        All model versions for entity{' '}
        <span className="font-mono text-xs">{entityId}</span>.
        Status transitions (draft → active → retired) are performed by running training /
        activation scripts; entity_admin may retire a model via the API.
      </p>

      {Object.keys(byKey).length === 0 ? (
        <p className="text-sm text-gray-500">
          No models registered yet. Run{' '}
          <span className="font-mono text-xs">tooling/ml/train_daily_iforest.py</span> or{' '}
          <span className="font-mono text-xs">tooling/ml/train_txn_iforest.py</span> to create one.
        </p>
      ) : (
        Object.entries(byKey).map(([key, versions]) => (
          <section key={key} className="space-y-2">
            <h2 className="text-base font-semibold text-gray-700 font-mono">{key}</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    {['Version', 'Algorithm', 'Status', 'Approved By', 'Approved At', 'Created', 'Hyperparams'].map(
                      (h) => (
                        <th key={h} className="px-4 py-2 text-left font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {versions.map((m) => (
                    <tr key={m.id} className="bg-white hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono">{m.version}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{m.algorithm}</td>
                      <td className="px-4 py-2">
                        <StatusPill status={m.status} />
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">
                        {m.approvedBy ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {m.approvedAt ? new Date(m.approvedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 max-w-xs">
                        <pre className="text-xs text-gray-500 truncate">
                          {JSON.stringify(m.hyperparamsJson, null, 0).slice(0, 80)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
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
