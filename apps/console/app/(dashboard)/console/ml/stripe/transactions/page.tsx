/**
 * /console/ml/stripe/transactions — Stripe Transaction Anomaly Scores
 *
 * Paginated table of per-transaction IsolationForest scores.
 * Default view: anomalies only (isAnomaly=true), last 30 days, limit 100.
 *
 * Note: This is a Server Component — pagination navigates via URL params.
 */
import { db } from '@nzila/db'
import { mlScoresStripeTxn, mlModels } from '@nzila/db/schema'
import { eq, and, desc, gte, lte } from 'drizzle-orm'
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

const PAGE_SIZE = 100

interface PageProps {
  searchParams: Promise<{
    anomalyOnly?: string
    startDate?: string
    endDate?: string
    page?: string
  }>
}

async function getTxnScores(
  entityId: string,
  opts: { anomalyOnly: boolean; startDate: string; endDate: string; offset: number },
) {
  const startTs = new Date(opts.startDate + 'T00:00:00Z')
  const endTs = new Date(opts.endDate + 'T23:59:59Z')

  const conditions = [
    eq(mlScoresStripeTxn.entityId, entityId),
    gte(mlScoresStripeTxn.occurredAt, startTs),
    lte(mlScoresStripeTxn.occurredAt, endTs),
    ...(opts.anomalyOnly ? [eq(mlScoresStripeTxn.isAnomaly, true)] : []),
  ]

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: mlScoresStripeTxn.id,
        occurredAt: mlScoresStripeTxn.occurredAt,
        amount: mlScoresStripeTxn.amount,
        currency: mlScoresStripeTxn.currency,
        score: mlScoresStripeTxn.score,
        isAnomaly: mlScoresStripeTxn.isAnomaly,
        threshold: mlScoresStripeTxn.threshold,
        stripePaymentIntentId: mlScoresStripeTxn.stripePaymentIntentId,
        stripeChargeId: mlScoresStripeTxn.stripeChargeId,
        modelKey: mlModels.modelKey,
      })
      .from(mlScoresStripeTxn)
      .innerJoin(mlModels, eq(mlScoresStripeTxn.modelId, mlModels.id))
      .where(and(...conditions))
      .orderBy(desc(mlScoresStripeTxn.occurredAt))
      .limit(PAGE_SIZE + 1)
      .offset(opts.offset),

    db
      .select({
        id: mlScoresStripeTxn.id,
        isAnomaly: mlScoresStripeTxn.isAnomaly,
      })
      .from(mlScoresStripeTxn)
      .where(
        and(
          eq(mlScoresStripeTxn.entityId, entityId),
          gte(mlScoresStripeTxn.occurredAt, startTs),
          lte(mlScoresStripeTxn.occurredAt, endTs),
        ),
      ),
  ])

  const hasMore = rows.length > PAGE_SIZE
  return {
    items: hasMore ? rows.slice(0, PAGE_SIZE) : rows,
    hasMore,
    totalInPeriod: totals.length,
    anomalyInPeriod: totals.filter((t) => t.isAnomaly).length,
  }
}

export default async function MlStripeTxnPage({ searchParams }: PageProps) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  const anomalyOnly = params.anomalyOnly !== 'false'
  const page = Math.max(0, parseInt(params.page ?? '0', 10))
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const startDate = params.startDate ?? thirtyDaysAgo
  const endDate = params.endDate ?? today

  const entityId = DEFAULT_ENTITY_ID
  const { items, hasMore, totalInPeriod, anomalyInPeriod } = await getTxnScores(entityId, {
    anomalyOnly,
    startDate,
    endDate,
    offset: page * PAGE_SIZE,
  })

  const prevHref = page > 0
    ? buildHref({ anomalyOnly, startDate, endDate, page: page - 1 })
    : null
  const nextHref = hasMore
    ? buildHref({ anomalyOnly, startDate, endDate, page: page + 1 })
    : null

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

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stripe Transaction Anomaly Scores</h1>
          <p className="text-sm text-gray-500 mt-1">
            IsolationForest — Option B (per-transaction). Period: {startDate} → {endDate}
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <span className="font-semibold text-red-600">{anomalyInPeriod}</span> anomalous /{' '}
          {totalInPeriod} txns in period
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Link
          href={buildHref({ anomalyOnly: !anomalyOnly, startDate, endDate, page: 0 })}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
            anomalyOnly
              ? 'bg-amber-100 border-amber-300 text-amber-800'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {anomalyOnly ? '⚠ Anomalies only' : 'All transactions'}
        </Link>
        <span className="text-xs text-gray-400">Page {page + 1}</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
          No transaction scores found for this period.
          {anomalyOnly && (
            <> Try{' '}
              <Link
                href={buildHref({ anomalyOnly: false, startDate, endDate, page: 0 })}
                className="underline text-blue-500"
              >
                showing all transactions
              </Link>{' '}
              or run{' '}
              <span className="font-mono text-xs">tooling/ml/infer_txn_iforest.py</span>.
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {[
                  'Occurred At',
                  'Amount',
                  'CCY',
                  'Score',
                  'Threshold',
                  'Anomaly?',
                  'Model Key',
                  'Payment Intent',
                  'Charge',
                ].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((s) => (
                <tr
                  key={s.id}
                  className={
                    s.isAnomaly ? 'bg-red-50 hover:bg-red-100' : 'bg-white hover:bg-gray-50'
                  }
                >
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {new Date(s.occurredAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 font-mono">
                    {parseFloat(String(s.amount)).toLocaleString('en-CA', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500 uppercase">{s.currency}</td>
                  <td className="px-4 py-2 font-mono">{parseFloat(String(s.score)).toFixed(5)}</td>
                  <td className="px-4 py-2 font-mono text-gray-400">
                    {parseFloat(String(s.threshold)).toFixed(5)}
                  </td>
                  <td className="px-4 py-2">
                    {s.isAnomaly ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
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
                    {s.stripePaymentIntentId ?? '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-400 truncate max-w-[8rem]">
                    {s.stripeChargeId ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center gap-3 text-sm">
        {prevHref ? (
          <Link href={prevHref} className="px-4 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
            ← Prev
          </Link>
        ) : (
          <span className="px-4 py-1.5 rounded border border-gray-100 text-gray-300 cursor-default">
            ← Prev
          </span>
        )}
        {nextHref ? (
          <Link href={nextHref} className="px-4 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
            Next →
          </Link>
        ) : (
          <span className="px-4 py-1.5 rounded border border-gray-100 text-gray-300 cursor-default">
            Next →
          </span>
        )}
      </div>
    </div>
  )
}

function buildHref(p: {
  anomalyOnly: boolean
  startDate: string
  endDate: string
  page: number
}) {
  const qs = new URLSearchParams({
    anomalyOnly: String(p.anomalyOnly),
    startDate: p.startDate,
    endDate: p.endDate,
    page: String(p.page),
  })
  return `/console/ml/stripe/transactions?${qs.toString()}`
}
