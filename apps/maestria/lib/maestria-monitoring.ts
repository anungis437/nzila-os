/**
 * In-memory request monitoring for @nzila/maestria.
 * Keeps a ring buffer of the last MAX_ENTRIES requests and computes
 * aggregate latency percentiles + error rates on demand.
 */

const MAX_ENTRIES = 1_000

interface RequestEntry {
  method: string
  path: string
  statusCode: number
  durationMs: number
  ts: number
}

export interface RouteMetrics {
  route: string
  count: number
  errorCount: number
  errorRate: number
  p50: number
  p95: number
  p99: number
  avgMs: number
}

export interface MetricsSummary {
  capturedRequests: number
  overallErrorRate: number
  p50: number
  p95: number
  p99: number
  avgMs: number
  routes: RouteMetrics[]
  since: string
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

class MonitoringStore {
  private buffer: RequestEntry[] = []
  private head = 0
  private count = 0
  private readonly startedAt = new Date().toISOString()

  recordRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    const entry: RequestEntry = { method, path, statusCode, durationMs, ts: Date.now() }
    if (this.count < MAX_ENTRIES) {
      this.buffer.push(entry)
      this.count++
    } else {
      this.buffer[this.head] = entry
      this.head = (this.head + 1) % MAX_ENTRIES
    }
  }

  getMetricsSummary(): MetricsSummary {
    const entries = this.buffer.slice()
    if (entries.length === 0) {
      return {
        capturedRequests: 0,
        overallErrorRate: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        avgMs: 0,
        routes: [],
        since: this.startedAt,
      }
    }

    const allDurations = entries.map((e) => e.durationMs).sort((a, b) => a - b)
    const totalErrors = entries.filter((e) => e.statusCode >= 400).length

    // Group by normalised route
    const byRoute = new Map<string, RequestEntry[]>()
    for (const entry of entries) {
      const key = `${entry.method} ${normalisePath(entry.path)}`
      const bucket = byRoute.get(key) ?? []
      bucket.push(entry)
      byRoute.set(key, bucket)
    }

    const routes: RouteMetrics[] = []
    for (const [route, routeEntries] of byRoute) {
      const durations = routeEntries.map((e) => e.durationMs).sort((a, b) => a - b)
      const errors = routeEntries.filter((e) => e.statusCode >= 400).length
      routes.push({
        route,
        count: routeEntries.length,
        errorCount: errors,
        errorRate: errors / routeEntries.length,
        p50: percentile(durations, 50),
        p95: percentile(durations, 95),
        p99: percentile(durations, 99),
        avgMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      })
    }

    routes.sort((a, b) => b.count - a.count)

    return {
      capturedRequests: entries.length,
      overallErrorRate: totalErrors / entries.length,
      p50: percentile(allDurations, 50),
      p95: percentile(allDurations, 95),
      p99: percentile(allDurations, 99),
      avgMs: Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length),
      routes,
      since: this.startedAt,
    }
  }

  reset(): void {
    this.buffer = []
    this.head = 0
    this.count = 0
  }
}

/** Replace path segments that look like IDs with :id placeholder. */
function normalisePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d{4,}/g, '/:id')
}

export const monitoringStore = new MonitoringStore()
export const { recordRequest, getMetricsSummary } = {
  recordRequest: monitoringStore.recordRequest.bind(monitoringStore),
  getMetricsSummary: monitoringStore.getMetricsSummary.bind(monitoringStore),
}
