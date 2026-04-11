/**
 * @nzila/os-core — SLO Definitions & Metrics
 *
 * Defines Service Level Objectives per app, emits metrics for monitoring,
 * and provides a metrics registry for RED metrics (Rate, Errors, Duration).
 *
 * Each app starts by calling `initMetrics()` which creates counters/histograms
 * for HTTP requests, AI inference, ML scoring, webhook processing, and
 * reconciliation events.
 *
 * SLO definitions are codified here — not in dashboards — to serve as the
 * single source of truth for alerting and reporting.
 */

// ── SLO Definitions ──────────────────────────────────────────────────────

export interface SloDefinition {
  /** Service/app identifier */
  service: string
  /** SLO name */
  name: string
  /** Target percentage (e.g. 99.9 = 99.9%) */
  target: number
  /** What is being measured */
  metric: string
  /** Rolling window in hours */
  windowHours: number
  /** Description */
  description: string
  /** Alert threshold (percentage below target that triggers alert) */
  alertThreshold: number
}

/**
 * Canonical SLO definitions for all Nzila services.
 * These are the contractual availability/quality targets.
 */
export const SLO_DEFINITIONS: SloDefinition[] = [
  // ── Console App ──────────────────────────────────────────────────────
  {
    service: 'console',
    name: 'api-availability',
    target: 99.9,
    metric: 'http_requests_success_rate',
    windowHours: 720, // 30 days
    description: 'Console API returns 2xx/3xx for 99.9% of requests',
    alertThreshold: 0.5,
  },
  {
    service: 'console',
    name: 'api-latency-p99',
    target: 95,
    metric: 'http_request_duration_p99_under_2s',
    windowHours: 168, // 7 days
    description: '95% of Console API requests complete under 2s at p99',
    alertThreshold: 2,
  },
  {
    service: 'console',
    name: 'ai-inference-success',
    target: 99.5,
    metric: 'ai_inference_success_rate',
    windowHours: 720,
    description: 'AI inference requests succeed 99.5% of the time',
    alertThreshold: 1,
  },

  // ── Partners App ─────────────────────────────────────────────────────
  {
    service: 'partners',
    name: 'api-availability',
    target: 99.9,
    metric: 'http_requests_success_rate',
    windowHours: 720,
    description: 'Partners API returns 2xx/3xx for 99.9% of requests',
    alertThreshold: 0.5,
  },

  // ── Web App ──────────────────────────────────────────────────────────
  {
    service: 'web',
    name: 'page-availability',
    target: 99.95,
    metric: 'http_requests_success_rate',
    windowHours: 720,
    description: 'Public web pages available 99.95% of the time',
    alertThreshold: 0.3,
  },

  // ── UnionEyes ───────────────────────────────────────────────────────
  {
    service: 'union-eyes',
    name: 'api-availability',
    target: 99.5,
    metric: 'http_requests_success_rate',
    windowHours: 720,
    description: 'UnionEyes API available 99.5% of the time',
    alertThreshold: 1,
  },
  {
    service: 'union-eyes',
    name: 'ml-inference-success',
    target: 99.0,
    metric: 'ml_inference_success_rate',
    windowHours: 720,
    description: 'ML inference requests succeed 99% of the time',
    alertThreshold: 2,
  },

  // ── Stripe Webhooks ──────────────────────────────────────────────────
  {
    service: 'stripe-webhooks',
    name: 'webhook-processing',
    target: 99.9,
    metric: 'stripe_webhook_success_rate',
    windowHours: 720,
    description: 'Stripe webhooks processed successfully 99.9% of the time',
    alertThreshold: 0.5,
  },

  // ── QBO Sync ─────────────────────────────────────────────────────────
  {
    service: 'qbo-sync',
    name: 'sync-success',
    target: 99.0,
    metric: 'qbo_sync_success_rate',
    windowHours: 720,
    description: 'QBO sync operations succeed 99% of the time',
    alertThreshold: 2,
  },
]

// ── Metrics Registry ──────────────────────────────────────────────────────

export interface MetricCounter {
  name: string
  labels: Record<string, string>
  value: number
  timestamp: number
}

export interface MetricHistogram {
  name: string
  labels: Record<string, string>
  buckets: number[]
  counts: number[]
  sum: number
  count: number
  timestamp: number
}

/**
 * In-process metrics collector.
 * In production, these are scraped by OTel Collector and forwarded to
 * the monitoring backend (Azure Monitor / Prometheus).
 */
class MetricsRegistry {
  private counters = new Map<string, MetricCounter>()
  private histograms = new Map<string, MetricHistogram>()
  private appName = 'unknown'

  init(appName: string): void {
    this.appName = appName
  }

  // ── Counter operations ──────────────────────────────────────────────

  incrementCounter(
    name: string,
    labels: Record<string, string> = {},
    value = 1,
  ): void {
    const key = `${name}:${JSON.stringify(labels)}`
    const existing = this.counters.get(key)
    if (existing) {
      existing.value += value
      existing.timestamp = Date.now()
    } else {
      this.counters.set(key, {
        name,
        labels: { app: this.appName, ...labels },
        value,
        timestamp: Date.now(),
      })
    }
  }

  // ── Histogram operations ────────────────────────────────────────────

  private static DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000]

  recordHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {},
    buckets: number[] = MetricsRegistry.DEFAULT_BUCKETS,
  ): void {
    const key = `${name}:${JSON.stringify(labels)}`
    const existing = this.histograms.get(key)
    if (existing) {
      existing.sum += value
      existing.count += 1
      for (let i = 0; i < existing.buckets.length; i++) {
        if (value <= existing.buckets[i]) {
          existing.counts[i] += 1
        }
      }
      existing.timestamp = Date.now()
    } else {
      const counts = buckets.map((b) => (value <= b ? 1 : 0))
      this.histograms.set(key, {
        name,
        labels: { app: this.appName, ...labels },
        buckets,
        counts,
        sum: value,
        count: 1,
        timestamp: Date.now(),
      })
    }
  }

  // ── Convenience methods ─────────────────────────────────────────────

  /** Record an HTTP request outcome */
  httpRequest(method: string, path: string, status: number, durationMs: number): void {
    const statusClass = `${Math.floor(status / 100)}xx`
    this.incrementCounter('http_requests_total', { method, path, status: String(status), status_class: statusClass })
    this.recordHistogram('http_request_duration_ms', durationMs, { method, path })

    if (status >= 500) {
      this.incrementCounter('http_errors_total', { method, path, status: String(status) })
    }
  }

  /** Record an AI inference outcome */
  aiInference(profileKey: string, success: boolean, durationMs: number, costUsd?: number): void {
    this.incrementCounter('ai_inference_total', { profile: profileKey, success: String(success) })
    this.recordHistogram('ai_inference_duration_ms', durationMs, { profile: profileKey })
    if (!success) {
      this.incrementCounter('ai_inference_errors_total', { profile: profileKey })
    }
    if (costUsd !== undefined) {
      this.incrementCounter('ai_inference_cost_usd', { profile: profileKey }, costUsd)
    }
  }

  /** Record an ML inference outcome */
  mlInference(modelKey: string, success: boolean, durationMs: number): void {
    this.incrementCounter('ml_inference_total', { model: modelKey, success: String(success) })
    this.recordHistogram('ml_inference_duration_ms', durationMs, { model: modelKey })
    if (!success) {
      this.incrementCounter('ml_inference_errors_total', { model: modelKey })
    }
  }

  /** Record a webhook processing outcome */
  webhookProcessed(provider: string, eventType: string, success: boolean, durationMs: number): void {
    this.incrementCounter('webhook_total', { provider, event_type: eventType, success: String(success) })
    this.recordHistogram('webhook_duration_ms', durationMs, { provider, event_type: eventType })
    if (!success) {
      this.incrementCounter('webhook_errors_total', { provider, event_type: eventType })
    }
  }

  /** Record a QBO sync operation */
  qboSync(operation: string, success: boolean, durationMs: number): void {
    this.incrementCounter('qbo_sync_total', { operation, success: String(success) })
    this.recordHistogram('qbo_sync_duration_ms', durationMs, { operation })
    if (!success) {
      this.incrementCounter('qbo_sync_errors_total', { operation })
    }
  }

  /** Record a reconciliation check */
  reconciliation(type: string, match: boolean, deltaAmountCents?: number): void {
    this.incrementCounter('reconciliation_checks_total', { type, match: String(match) })
    if (!match) {
      this.incrementCounter('reconciliation_mismatches_total', { type })
    }
    if (deltaAmountCents !== undefined) {
      this.recordHistogram('reconciliation_delta_cents', Math.abs(deltaAmountCents), { type })
    }
  }

  // ── Export for monitoring ───────────────────────────────────────────

  /** Get all current metrics for export/scraping */
  getSnapshot(): { counters: MetricCounter[]; histograms: MetricHistogram[] } {
    return {
      counters: Array.from(this.counters.values()),
      histograms: Array.from(this.histograms.values()),
    }
  }

  /** Reset all metrics (for testing) */
  reset(): void {
    this.counters.clear()
    this.histograms.clear()
  }
}

// Singleton
export const metrics = new MetricsRegistry()

/**
 * Initialize metrics collection for an app.
 * Call once at startup (e.g. in instrumentation.ts).
 */
export function initMetrics(appName: string): MetricsRegistry {
  metrics.init(appName)
  return metrics
}
