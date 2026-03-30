/**
 * /portal/ml/summary — ML Anomaly Summary (Partner View)
 *
 * Read-only summary of ML anomaly detection results visible to partners.
 * Shows aggregate daily anomaly counts only — no per-transaction details,
 * no raw feature vectors, no model internals.
 *
 * Auth: session checked by parent portal layout.
 * Entitlement: partner must have `ml:summary` view for the entity.
 *              Resolved and enforced entirely by /portal/api/ml/summary —
 *              this page has zero direct DB access.
 */
import { auth } from '@clerk/nextjs/server'
import { ChartBarIcon, ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

interface MlSummaryResponse {
  orgId: string
  daysScored: number
  recentAnomalyDays: number
  totalDailyAnomalies: number
  totalTxnAnomalies: number
  recentDailyScores: {
    date: string
    isAnomaly: boolean
    score: string
    modelKey: string
  }[]
}

type FetchResult =
  | { ok: true; data: MlSummaryResponse }
  | { ok: false; notEntitled: boolean }

async function fetchMlSummary(): Promise<FetchResult> {
  const session = await auth()
  const token = await session.getToken()

  const baseUrl =
    process.env.NEXT_PUBLIC_PARTNERS_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3002')

  // No orgId — route self-resolves from the partner session.
  const res = await fetch(`${baseUrl}/portal/api/ml/summary`, {
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
      'Content-Type': 'application/json',
    },
  })

  if (res.status === 403) return { ok: false, notEntitled: true }
  if (!res.ok) return { ok: false, notEntitled: false }
  return { ok: true, data: await res.json() as MlSummaryResponse }
}

export default async function PartnerMlSummaryPage() {
  const result = await fetchMlSummary()

  if (!result.ok) {
    if (result.notEntitled) {
      return (
        <div className="max-w-5xl space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">ML Anomaly Summary</h1>
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
            Your organisation does not have ML summary access for any entity.
            Please contact your Nzila account manager to request access.
          </div>
        </div>
      )
    }
    return (
      <div className="max-w-5xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">ML Anomaly Summary</h1>
        <div className="rounded-xl border border-dashed border-red-200 p-8 text-center text-sm text-red-400">
          Unable to load ML summary. Please try again later.
        </div>
      </div>
    )
  }

  const summary = result.data

  const { recentDailyScores, totalTxnAnomalies, daysScored, recentAnomalyDays } = summary

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ML Anomaly Summary</h1>
        <p className="mt-1 text-sm text-slate-500">
          Automated anomaly detection powered by Nzila&apos;s IsolationForest ML engine.
          Last 30 days of Stripe payment data — aggregate view only.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={ChartBarIcon}
          label="Days Scored (30d)"
          value={String(daysScored)}
          sub="Daily batches with active model"
        />
        <SummaryCard
          icon={ExclamationTriangleIcon}
          label="Anomalous Days (30d)"
          value={String(recentAnomalyDays)}
          sub="Days flagged by IsolationForest"
          variant={recentAnomalyDays > 0 ? 'warning' : 'normal'}
        />
        <SummaryCard
          icon={ShieldCheckIcon}
          label="Txn Anomalies (all time)"
          value={String(totalTxnAnomalies)}
          sub="Per-transaction anomalies detected"
          variant={Number(totalTxnAnomalies) > 0 ? 'warning' : 'normal'}
        />
      </div>

      {/* Recent daily scores */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 mb-3">
          Daily Scores — Last 30 Days
        </h2>

        {recentDailyScores.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
            No scores available for the last 30 days. Inference pipeline may not have run yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {['Date', 'Status', 'Anomaly Score'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentDailyScores.map((s) => (
                  <tr
                    key={s.date}
                    className={
                      s.isAnomaly
                        ? 'bg-amber-50 hover:bg-amber-100'
                        : 'bg-white hover:bg-slate-50'
                    }
                  >
                    <td className="px-5 py-3 font-mono text-xs">{s.date}</td>
                    <td className="px-5 py-3">
                      {s.isAnomaly ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          <ExclamationTriangleIcon className="w-3 h-3" />
                          Anomaly flagged
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          <ShieldCheckIcon className="w-3 h-3" />
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">
                      {parseFloat(String(s.score)).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-400">
        For full transaction-level anomaly details, please contact your Nzila account manager.
        Model governance and retraining schedules are managed by the Nzila platform team.
      </p>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  variant = 'normal',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub: string
  variant?: 'normal' | 'warning'
}) {
  const base = variant === 'warning' && Number(value) > 0
    ? 'border-amber-200 bg-amber-50'
    : 'border-slate-200 bg-white'

  return (
    <div className={`rounded-xl border p-5 ${base}`}>
      <Icon className="w-5 h-5 text-slate-400 mb-3" />
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}
