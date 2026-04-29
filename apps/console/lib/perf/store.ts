/**
 * In-process performance telemetry ring buffer.
 *
 * Captures Web Vitals + server route timings for the Console itself.
 * Designed to be:
 *   - dependency-free (no Redis, no DB writes)
 *   - cheap (bounded ring, O(1) push)
 *   - honest (returns null when no samples)
 *
 * NOT a replacement for platform-observability — this is just the
 * Console's own self-reporting surface so /ops/performance can render
 * real numbers without waiting on the bigger telemetry programme.
 *
 * In multi-replica deployments each replica holds its own ring and the
 * page renders the locally observed slice. That trade-off is documented
 * on the page and is acceptable for a self-monitoring dashboard.
 */
const MAX_VITALS = 2000
const MAX_ROUTES = 1000

export type VitalName = 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP'

export interface VitalSample {
  name: VitalName
  value: number
  route: string
  ts: number
}

export interface RouteSample {
  route: string
  durationMs: number
  status: number
  ts: number
}

const vitals: VitalSample[] = []
const routes: RouteSample[] = []
// ga-check:exempt bounded in-process telemetry ring support, not source-of-truth persistence
const failedActions = new Map<string, { count: number; lastAt: number }>()

export function recordVital(sample: VitalSample): void {
  vitals.push(sample)
  if (vitals.length > MAX_VITALS) vitals.splice(0, vitals.length - MAX_VITALS)
}

export function recordRoute(sample: RouteSample): void {
  routes.push(sample)
  if (routes.length > MAX_ROUTES) routes.splice(0, routes.length - MAX_ROUTES)
  if (sample.status >= 500) {
    const cur = failedActions.get(sample.route) ?? { count: 0, lastAt: 0 }
    cur.count += 1
    cur.lastAt = sample.ts
    failedActions.set(sample.route, cur)
  }
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

export interface VitalSummary {
  name: VitalName
  p75: number | null
  count: number
  unit: 'ms' | 'score'
}

export function summarizeVitals(windowMs = 24 * 60 * 60 * 1000): VitalSummary[] {
  const cutoff = Date.now() - windowMs
  const recent = vitals.filter(v => v.ts >= cutoff)
  const names: VitalName[] = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP']
  return names.map(name => {
    const samples = recent.filter(v => v.name === name).map(v => v.value)
    return {
      name,
      p75: percentile(samples, 75),
      count: samples.length,
      unit: name === 'CLS' ? 'score' : 'ms',
    }
  })
}

export interface RouteSummary {
  route: string
  median: number | null
  p95: number | null
  count: number
}

export function summarizeRoutes(windowMs = 60 * 60 * 1000): RouteSummary[] {
  const cutoff = Date.now() - windowMs
  const recent = routes.filter(r => r.ts >= cutoff)
  const byRoute = new Map<string, number[]>()
  for (const r of recent) {
    const arr = byRoute.get(r.route) ?? []
    arr.push(r.durationMs)
    byRoute.set(r.route, arr)
  }
  const out: RouteSummary[] = []
  for (const [route, values] of byRoute) {
    out.push({
      route,
      median: percentile(values, 50),
      p95: percentile(values, 95),
      count: values.length,
    })
  }
  out.sort((a, b) => (b.p95 ?? 0) - (a.p95 ?? 0))
  return out.slice(0, 10)
}

export interface FailedActionSummary {
  route: string
  count: number
  lastAt: number
}

export function summarizeFailedActions(): FailedActionSummary[] {
  return [...failedActions.entries()]
    .map(([route, v]) => ({ route, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

export function isCollecting(): boolean {
  return vitals.length > 0 || routes.length > 0
}

/** Test helper — clears all rings. */
export function __resetForTests(): void {
  vitals.length = 0
  routes.length = 0
  failedActions.clear()
}
