/**
 * Nzila OS — Ops Confidence Score Dashboard
 *
 * Displays a single composite operational confidence score (0–100),
 * weekly delta, component breakdown, and grade.
 *
 * Platform admin / ops only. No secrets exposed.
 *
 * @see @nzila/platform-ops/ops-score
 */
import { requireRole } from '@/lib/rbac'
import { getOpsScoreHistory } from '@/lib/server-data'
import {
  computeOpsScore,
  computeOpsScoreDelta,
  type OpsScoreInput,
  type OpsScoreDelta,
} from '@nzila/platform-ops'
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ServerStackIcon,
  BoltIcon,
  BugAntIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// ── Helpers ────────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-green-100 text-green-800 border-green-200'
    case 'B': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'D': return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'F': return 'bg-red-100 text-red-800 border-red-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function DeltaIconInline({ direction, className }: { direction: OpsScoreDelta['direction']; className?: string }) {
  switch (direction) {
    case 'up': return <ArrowTrendingUpIcon className={className} />
    case 'down': return <ArrowTrendingDownIcon className={className} />
    default: return <MinusIcon className={className} />
  }
}

function deltaColor(direction: OpsScoreDelta['direction']): string {
  switch (direction) {
    case 'up': return 'text-green-600'
    case 'down': return 'text-red-600'
    default: return 'text-gray-400'
  }
}

function ComponentIconInline({ name, className }: { name: string; className?: string }) {
  if (name.includes('SLO')) return <ShieldCheckIcon className={className} />
  if (name.includes('Error')) return <BugAntIcon className={className} />
  if (name.includes('Integration')) return <BoltIcon className={className} />
  if (name.includes('DLQ')) return <ServerStackIcon className={className} />
  if (name.includes('Regression')) return <ExclamationTriangleIcon className={className} />
  return <ChartBarIcon className={className} />
}

// ── Data Loading ───────────────────────────────────────────────────────────

/**
 * Gather ops score inputs and compute results.
 * In production, inputs come from the metrics pipeline.
 * All impure calls (Date, env, DB) live here — outside the render path.
 */
async function loadOpsScoreData() {
  const inputs: OpsScoreInput = {
    sloCompliancePct: Number(process.env.OPS_SLO_COMPLIANCE_PCT ?? '95'),
    errorDeltaPct: Number(process.env.OPS_ERROR_DELTA_PCT ?? '0.5'),
    integrationSlaPct: Number(process.env.OPS_INTEGRATION_SLA_PCT ?? '99.5'),
    dlqBacklogRatio: Number(process.env.OPS_DLQ_BACKLOG_RATIO ?? '0.1'),
    regressionSeverity: Number(process.env.OPS_REGRESSION_SEVERITY ?? '0'),
  }

  const result = computeOpsScore(inputs)

  const history = await getOpsScoreHistory(result.score, result.grade)
  const delta = computeOpsScoreDelta(result.score, history)

  return { result, delta }
}

// ── Page Component ─────────────────────────────────────────────────────────

export default async function OpsScorePage() {
  await requireRole('platform_admin', 'studio_admin', 'ops')

  const { result, delta } = await loadOpsScoreData()

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Ops Confidence Score</h1>
        <p className="text-gray-500 mt-1">
          Weighted composite operational health indicator — updated daily
        </p>
      </div>

      {/* Score Hero Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-8 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Large score display */}
            <div className="text-center">
              <div className="text-6xl font-bold text-gray-900">{result.score}</div>
              <div className="text-sm text-gray-500 mt-1">out of 100</div>
            </div>

            {/* Grade badge */}
            <div className={`inline-flex items-center px-4 py-2 rounded-lg border text-2xl font-bold ${gradeColor(result.grade)}`}>
              {result.grade}
            </div>
          </div>

          {/* Delta */}
          <div className="text-right">
            <div className={`flex items-center gap-1 text-lg font-semibold ${deltaColor(delta.direction)}`}>
              <DeltaIconInline direction={delta.direction} className="h-5 w-5" />
              {delta.delta > 0 ? '+' : ''}{delta.delta} pts
            </div>
            <div className="text-sm text-gray-400">vs 7 days ago</div>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-600">{result.status}</div>
      </div>

      {/* Component Breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Score Components</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Hover over each component to see how it contributes to the final score
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-6 py-3 font-medium">Component</th>
              <th className="px-6 py-3 font-medium">Raw Value</th>
              <th className="px-6 py-3 font-medium">Normalised</th>
              <th className="px-6 py-3 font-medium">Weight</th>
              <th className="px-6 py-3 font-medium">Contribution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {result.components.map((c) => {
              return (
                <tr key={c.name} className="text-gray-700">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <ComponentIconInline name={c.name} className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 font-mono text-xs">{c.rawValue}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${c.normalisedScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{c.normalisedScore.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500">{(c.weight * 100).toFixed(0)}%</td>
                  <td className="px-6 py-3 font-semibold">{c.contribution.toFixed(1)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
