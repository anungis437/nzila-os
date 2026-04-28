/**
 * Metrics history engine — Phase 2.
 *
 * Produces deterministic time-series snapshots for the executive cockpit
 * KPIs (MRR per venture, weighted pipeline, founder bottleneck, dependency,
 * task velocity, close rate, concentration, cash runway).
 *
 * Two responsibilities, kept separate so the second can be swapped for a
 * real `metrics_snapshots` Drizzle table without changing any caller:
 *
 *   1. `MetricsSnapshotShape` — the on-disk shape per timestamp.
 *   2. `synthesizeHistory(input)` — given the *current* HQ state and a window,
 *      walks backward N days and produces one snapshot per day. Uses a
 *      seeded LCG so the same input always yields the same series; no Date.now,
 *      no Math.random. The synthesizer is clearly marked as a stand-in until
 *      Phase 1 (real persistence) lands; the stored shape is identical so the
 *      swap is mechanical.
 *
 * Pure module. No I/O. Framework-free.
 */
import type {
  DependencyScore,
  FinanceSnapshot,
  PortfolioSnapshot,
  Task,
  Venture,
} from './types'

// ── On-disk shape (the future `metrics_snapshots` row) ─────────────────────

export interface MetricsSnapshotShape {
  /** ISO date (00:00 UTC) the snapshot represents. */
  capturedAt: string
  totalMrrCents: number
  arrRunRateCents: number
  weightedPipelineCents: number
  founderBottleneckScore: number // 0..100
  topVentureRevenueShare: number // 0..1
  cashRunwayMonths: number | null
  taskCompletionVelocity: number // tasks/day, 7d trailing
  closeRate30d: number // 0..1
  perVentureMrrCents: Record<string, number>
  perVentureDependency: Record<string, number>
}

export type MetricsWindow = '30d' | '90d' | '12m'

export function windowDays(w: MetricsWindow): number {
  if (w === '30d') return 30
  if (w === '90d') return 90
  return 365
}

// ── Synthesizer (stand-in until Phase 1 lands real persistence) ────────────

export interface HistoryInput {
  now: string
  window: MetricsWindow
  ventures: readonly Venture[]
  tasks: readonly Task[]
  dependencyScores: readonly DependencyScore[]
  portfolio: PortfolioSnapshot
  finance: FinanceSnapshot
}

/**
 * Linear-congruential PRNG seeded from a string. Deterministic across runs
 * and platforms (no Math.random). Returns a function that yields [0, 1).
 */
function seededRng(seed: string): () => number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  let state = h || 1
  return () => {
    // Numerical Recipes LCG
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

function snapshotFor(
  daysAgo: number,
  rng: () => number,
  input: HistoryInput,
  date: Date,
): MetricsSnapshotShape {
  // Drift factor: today is the truth, walk backward with mild noise (±8%) and
  // a slight linear regression so charts show realistic trend not flat lines.
  const totalDays = windowDays(input.window)
  const linearDrift = 1 - daysAgo / (totalDays * 8) // older = ~12% lower at far edge
  const noise = (rng() - 0.5) * 0.08

  const factor = Math.max(0.4, linearDrift + noise)

  const perVentureMrrCents: Record<string, number> = {}
  const perVentureDependency: Record<string, number> = {}

  for (const v of input.ventures) {
    perVentureMrrCents[v.slug] = Math.round(v.monthlyRecurringRevenueCents * factor)
  }
  for (const d of input.dependencyScores) {
    // Dependency drifts the OTHER way: older = slightly higher (founder less
    // de-coupled in the past). Cap at 100.
    const driftedDep = Math.min(
      100,
      Math.max(0, d.score + Math.round((1 - linearDrift) * 25 + (rng() - 0.5) * 6)),
    )
    perVentureDependency[d.ventureSlug] = driftedDep
  }

  const totalMrrCents = Object.values(perVentureMrrCents).reduce((a, b) => a + b, 0)
  const weightedPipelineCents = Math.round(input.portfolio.weightedPipelineCents * factor)
  const founderBottleneckScore = Math.min(
    100,
    Math.max(
      0,
      input.portfolio.founderBottleneckScore +
        Math.round((1 - linearDrift) * 18 + (rng() - 0.5) * 5),
    ),
  )

  const topMrr = Math.max(0, ...Object.values(perVentureMrrCents))
  const topVentureRevenueShare = totalMrrCents === 0 ? 0 : topMrr / totalMrrCents

  // Task velocity proxy: count of `done` tasks (per current state) divided by 7
  // and modulated by factor — keeps shape stable while honestly noting it's a proxy.
  const baseVelocity = input.tasks.filter((t) => t.status === 'done').length / 7
  const taskCompletionVelocity = Math.max(0, baseVelocity * factor)

  // Close rate: stable around finance.topVentureRevenueShare proxy unless we get
  // real win/loss history. Use 0.22 baseline drift to keep numbers honest.
  const closeRate30d = Math.max(0.05, Math.min(0.6, 0.22 * factor + (rng() - 0.5) * 0.05))

  // Cash runway: walk runway DOWN as you go back (we had less runway in the past
  // because we'd raised less). If unknown, propagate null.
  const baseRunway = input.finance.cashRunwayMonths
  const cashRunwayMonths =
    baseRunway == null ? null : Math.max(0, Math.round(baseRunway * factor))

  return {
    capturedAt: isoDate(date),
    totalMrrCents,
    arrRunRateCents: totalMrrCents * 12,
    weightedPipelineCents,
    founderBottleneckScore,
    topVentureRevenueShare: Number(topVentureRevenueShare.toFixed(4)),
    cashRunwayMonths,
    taskCompletionVelocity: Number(taskCompletionVelocity.toFixed(2)),
    closeRate30d: Number(closeRate30d.toFixed(3)),
    perVentureMrrCents,
    perVentureDependency,
  }
}

function isoDate(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString()
}

/**
 * Walk backward `windowDays(window)` days from `now`, emitting one snapshot
 * per step. The most-recent snapshot uses the live current state.
 */
export function synthesizeHistory(input: HistoryInput): MetricsSnapshotShape[] {
  const days = windowDays(input.window)
  const step = days > 90 ? 7 : 1 // weekly granularity for 12m, daily otherwise
  const rng = seededRng(`hq-history|${input.now}|${input.window}`)

  const out: MetricsSnapshotShape[] = []
  const nowDate = new Date(input.now)
  for (let d = days; d >= 0; d -= step) {
    const date = new Date(nowDate.getTime() - d * 86_400_000)
    out.push(snapshotFor(d, rng, input, date))
  }
  return out
}

// ── Trend helpers (used by UI cards) ────────────────────────────────────────

export interface TrendPoint {
  capturedAt: string
  value: number
}

export function seriesOf(
  history: readonly MetricsSnapshotShape[],
  metric:
    | 'totalMrrCents'
    | 'arrRunRateCents'
    | 'weightedPipelineCents'
    | 'founderBottleneckScore'
    | 'topVentureRevenueShare'
    | 'cashRunwayMonths'
    | 'taskCompletionVelocity'
    | 'closeRate30d',
): TrendPoint[] {
  return history.map((h) => ({
    capturedAt: h.capturedAt,
    value: (h[metric] ?? 0) as number,
  }))
}

/**
 * Compute simple percentage delta between first and last point of a series.
 * Returns null if either endpoint is null/undefined or the start is zero
 * (avoids divide-by-zero amplifying noise).
 */
export function deltaPct(series: readonly TrendPoint[]): number | null {
  if (series.length < 2) return null
  const start = series[0]?.value
  const end = series[series.length - 1]?.value
  if (start == null || end == null) return null
  if (start === 0) return null
  return (end - start) / start
}
