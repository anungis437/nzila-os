/**
 * /console/ml/stripe/daily — Stripe Daily Anomaly Scores
 *
 * Shows the last 90 days of daily IsolationForest scores, highlighting
 * anomalous days. Fetches directly from DB (RSC).
 */
import { db } from '@nzila/db'
import { mlScoresStripeDaily, mlModels } from '@nzila/db/schema'
import { eq, and, desc, gte } from 'drizzle-orm'
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

async function getDailyScores(entityId: string) {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const startDate = ninetyDaysAgo.toISOString().slice(0, 10)

  return db
    .select({
      id: mlScoresStripeDaily.id,
      date: mlScoresStripeDaily.date,
      score: mlScoresStripeDaily.score,
      isAnomaly: mlScoresStripeDaily.isAnomaly,
      threshold: mlScoresStripeDaily.threshold,
      modelKey: mlModels.modelKey,
      modelId: mlScoresStripeDaily.modelId,
      inferenceRunId: mlScoresStripeDaily.inferenceRunId,
    })
    .from(mlScoresStripeDaily)
    .innerJoin(mlModels, eq(mlScoresStripeDaily.modelId, mlModels.id))
    .where(
      and(
        eq(mlScoresStripeDaily.entityId, entityId),
        gte(mlScoresStripeDaily.date, startDate),
      ),
    )
    .orderBy(desc(mlScoresStripeDaily.date))
}

export default async function MlStripeDailyPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const entityId = DEFAULT_ENTITY_ID
  const scores = await getDailyScores(entityId)

  const anomalyCount = scores.filter((s) => s.isAnomaly).length
  const totalCount = scores.length

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

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stripe Daily Anomaly Scores</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last 90 days — IsolationForest (stripe_anomaly_daily_iforest_v1)
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <span className="font-semibold text-amber-600">{anomalyCount}</span> anomalous /{' '}
          {totalCount} days scored
        </div>
      </div>

      {scores.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
          No daily scores yet. Run{' '}
          <span className="font-mono text-xs">tooling/ml/infer_daily_iforest.py</span> to generate
          scores.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {['Date', 'Score', 'Threshold', 'Anomaly?', 'Model Key', 'Inference Run'].map(
                  (h) => (
                    <th key={h} className="px-4 py-2 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {scores.map((s) => (
                <tr
                  key={s.id}
                  className={s.isAnomaly ? 'bg-amber-50 hover:bg-amber-100' : 'bg-white hover:bg-gray-50'}
                >
                  <td className="px-4 py-2 font-mono text-xs">{s.date}</td>
                  <td className="px-4 py-2 font-mono">{parseFloat(String(s.score)).toFixed(5)}</td>
                  <td className="px-4 py-2 font-mono text-gray-400">
                    {parseFloat(String(s.threshold)).toFixed(5)}
                  </td>
                  <td className="px-4 py-2">
                    {s.isAnomaly ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        ⚠ Anomaly
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Normal
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{s.modelKey}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-400 truncate max-w-[8rem]">
                    {s.inferenceRunId ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
