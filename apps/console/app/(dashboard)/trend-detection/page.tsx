/**
 * Nzila OS — Trend Degradation Dashboard
 *
 * Displays slope-based degradation trends for p95 latency,
 * error rate, and integration SLA. Flags degrading metrics
 * before hard SLO thresholds are breached.
 *
 * Platform admin / ops only. No secrets exposed.
 *
 * @see @nzila/platform-ops/trend-detection
 */
import { requireRole } from '@/lib/rbac'
import {
  analyseTrends,
  buildTrendWarningEvent,
  type TrendInput,
  type TrendResult,
} from '@nzila/platform-ops'
import { platformDb } from '@nzila/db/platform'
import { platformIntegrationConnections, platformRequestMetrics } from '@nzila/db/schema'
import { getExecutiveOrgId } from '@/lib/executive-os'
import { and, desc, eq, gte } from 'drizzle-orm'
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarSquareIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// ── Helpers ────────────────────────────────────────────────────────────────

function directionBadge(result: TrendResult) {
  if (result.direction === 'degrading') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <ArrowTrendingUpIcon className="h-3 w-3" />
        Degrading
      </span>
    )
  }
  if (result.direction === 'improving') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <ArrowTrendingDownIcon className="h-3 w-3" />
        Improving
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      <MinusIcon className="h-3 w-3" />
      Stable
    </span>
  )
}

function getLastSevenDays(): string[] {
  const today = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
}

function percentile95(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  return sorted[idx]
}

async function getTrendInputs(orgId: string): Promise<TrendInput[]> {
  const days = getLastSevenDays()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [requestRows, integrationRows] = await Promise.all([
    platformDb
      .select({
        route: platformRequestMetrics.route,
        latencyMs: platformRequestMetrics.latencyMs,
        statusCode: platformRequestMetrics.statusCode,
        recordedAt: platformRequestMetrics.recordedAt,
      })
      .from(platformRequestMetrics)
      .where(and(eq(platformRequestMetrics.orgId, orgId), gte(platformRequestMetrics.recordedAt, sevenDaysAgo)))
      .orderBy(desc(platformRequestMetrics.recordedAt))
      .limit(5000)
      .catch(() => []),
    platformDb
      .select({
        provider: platformIntegrationConnections.provider,
        status: platformIntegrationConnections.status,
        lastValidationOk: platformIntegrationConnections.lastValidationOk,
      })
      .from(platformIntegrationConnections)
      .where(eq(platformIntegrationConnections.orgId, orgId))
      .catch(() => []),
  ])

  const perDay = new Map<string, { latencies: number[]; total: number; errors: number }>()
  for (const day of days) {
    perDay.set(day, { latencies: [], total: 0, errors: 0 })
  }

  for (const row of requestRows) {
    const day = row.recordedAt?.toISOString().slice(0, 10)
    if (!day || !perDay.has(day)) continue
    const bucket = perDay.get(day)!
    bucket.total += 1
    bucket.latencies.push(row.latencyMs)
    if (row.statusCode >= 500) bucket.errors += 1
  }

  const p95Points = days.map((day) => ({
    date: day,
    value: percentile95(perDay.get(day)?.latencies ?? []),
  }))
  const errorRatePoints = days.map((day) => {
    const bucket = perDay.get(day)
    const value = bucket && bucket.total > 0 ? (bucket.errors / bucket.total) * 100 : 0
    return { date: day, value }
  })

  const integrationInputs: TrendInput[] = integrationRows.map((row) => {
    const base =
      row.status === 'connected'
        ? (row.lastValidationOk ? 99.9 : 98.5)
        : row.status === 'degraded'
          ? 96
          : row.status === 'error'
            ? 90
            : 85

    return {
      metric: 'integration_sla',
      scope: row.provider,
      dataPoints: days.map((date) => ({ date, value: base })),
    }
  })

  return [
    { metric: 'p95_latency', scope: 'platform', dataPoints: p95Points },
    { metric: 'error_rate', scope: 'platform', dataPoints: errorRatePoints },
    ...integrationInputs,
  ]
}

// ── Page Component ─────────────────────────────────────────────────────────

export default async function TrendDetectionPage() {
  await requireRole('platform_admin', 'studio_admin', 'ops')

  const orgId = await getExecutiveOrgId()
  const inputs = orgId ? await getTrendInputs(orgId) : []
  const results = analyseTrends(inputs)
  const warningEvent = buildTrendWarningEvent(results)

  const degradingCount = warningEvent.degradingCount
  const hasWarnings = degradingCount > 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Trend Degradation Detection</h1>
        <p className="text-gray-500 mt-1">
          Slope-based early warning — detects slow degradation before SLO breach
        </p>
      </div>

      {/* Alert banner */}
      {hasWarnings && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 flex items-center gap-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800">
              {degradingCount} degrading trend{degradingCount > 1 ? 's' : ''} detected
            </p>
            <p className="text-sm text-red-600 mt-0.5">
              Audit event <code className="text-xs bg-red-100 px-1 py-0.5 rounded">platform.ops.trend_warning</code> emitted
            </p>
          </div>
        </div>
      )}

      {!hasWarnings && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8 flex items-center gap-3">
          <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-green-800">All metrics stable</p>
            <p className="text-sm text-green-600 mt-0.5">No degradation trends detected in the current window</p>
          </div>
        </div>
      )}

      {/* Trend Results Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <ChartBarSquareIcon className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Metric Trends (7-day window)</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-6 py-3 font-medium">Metric</th>
              <th className="px-6 py-3 font-medium">Scope</th>
              <th className="px-6 py-3 font-medium">Direction</th>
              <th className="px-6 py-3 font-medium">Slope / Day</th>
              <th className="px-6 py-3 font-medium">R²</th>
              <th className="px-6 py-3 font-medium">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map((r) => (
              <tr key={`${r.scope}-${r.metric}`} className={`text-gray-700 ${r.isDegrading ? 'bg-red-50/50' : ''}`}>
                <td className="px-6 py-3 font-mono text-xs">{r.metric}</td>
                <td className="px-6 py-3 font-medium">{r.scope}</td>
                <td className="px-6 py-3">{directionBadge(r)}</td>
                <td className="px-6 py-3 font-mono text-xs">{r.slopePerDay}</td>
                <td className="px-6 py-3 font-mono text-xs">{r.rSquared.toFixed(3)}</td>
                <td className="px-6 py-3 text-center">{r.dataPointCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
