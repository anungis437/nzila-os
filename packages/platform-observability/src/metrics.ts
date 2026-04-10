/**
 * @nzila/platform-observability — Metrics Registry
 *
 * In-memory metrics registry with Prometheus text exposition format.
 * Supports counters, gauges, and histograms.
 *
 * @module @nzila/platform-observability/metrics
 */
import { createLogger } from './logger'
import type { MetricType as _MetricType, MetricDefinition, MetricSample } from './types'

const _logger = createLogger()

// ── Counter ─────────────────────────────────────────────────────────────────

export class Counter {
  readonly name: string
  readonly help: string
  private _value = 0
  private readonly _samples: MetricSample[] = []

  constructor(name: string, help: string) {
    this.name = name
    this.help = help
  }

  inc(delta = 1): void {
    if (delta < 0) {
      throw new Error('Counter cannot be decremented')
    }
    this._value += delta
    this._samples.push({
      name: this.name,
      type: 'counter',
      value: delta,
      labels: {},
      timestamp: Date.now(),
    })
  }

  get(): number {
    return this._value
  }

  samples(): MetricSample[] {
    return [...this._samples]
  }

  reset(): void {
    this._value = 0
    this._samples.length = 0
  }
}

// ── Gauge ───────────────────────────────────────────────────────────────────

export class Gauge {
  readonly name: string
  readonly help: string
  private _value = 0

  constructor(name: string, help: string) {
    this.name = name
    this.help = help
  }

  set(value: number): void {
    this._value = value
  }

  inc(delta = 1): void {
    this._value += delta
  }

  dec(delta = 1): void {
    this._value -= delta
  }

  get(): number {
    return this._value
  }

  reset(): void {
    this._value = 0
  }
}

// ── Histogram ───────────────────────────────────────────────────────────────

const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]

export class Histogram {
  readonly name: string
  readonly help: string
  readonly buckets: readonly number[]
  private readonly _observations: number[] = []

  constructor(name: string, help: string, buckets: number[] = DEFAULT_BUCKETS) {
    this.name = name
    this.help = help
    this.buckets = [...buckets].sort((a, b) => a - b)
  }

  observe(value: number): void {
    this._observations.push(value)
  }

  /**
   * Get percentile value. `p` is a fraction between 0 and 1 (e.g. 0.5 = p50).
   */
  percentile(p: number): number {
    if (this._observations.length === 0) return 0

    const sorted = [...this._observations].sort((a, b) => a - b)
    const idx = Math.ceil(p * sorted.length) - 1
    return sorted[Math.max(0, idx)]!
  }

  count(): number {
    return this._observations.length
  }

  sum(): number {
    return this._observations.reduce((a, b) => a + b, 0)
  }

  reset(): void {
    this._observations.length = 0
  }
}

// ── Metrics Registry ────────────────────────────────────────────────────────

/**
 * Central metrics registry. Collect all application metrics here
 * and expose via /metrics endpoint in Prometheus text format.
 */
export class MetricsRegistry {
  private readonly counters = new Map<string, Counter>()
  private readonly gauges = new Map<string, Gauge>()
  private readonly histograms = new Map<string, Histogram>()

  createCounter(name: string, help: string): Counter {
    const existing = this.counters.get(name)
    if (existing) return existing
    const counter = new Counter(name, help)
    this.counters.set(name, counter)
    return counter
  }

  createGauge(name: string, help: string): Gauge {
    const existing = this.gauges.get(name)
    if (existing) return existing
    const gauge = new Gauge(name, help)
    this.gauges.set(name, gauge)
    return gauge
  }

  createHistogram(name: string, help: string, buckets?: number[]): Histogram {
    const existing = this.histograms.get(name)
    if (existing) return existing
    const histogram = new Histogram(name, help, buckets)
    this.histograms.set(name, histogram)
    return histogram
  }

  /**
   * Get all registered metric definitions.
   */
  definitions(): MetricDefinition[] {
    const defs: MetricDefinition[] = []
    for (const c of this.counters.values()) {
      defs.push({ name: c.name, type: 'counter', help: c.help, labels: [] })
    }
    for (const g of this.gauges.values()) {
      defs.push({ name: g.name, type: 'gauge', help: g.help, labels: [] })
    }
    for (const h of this.histograms.values()) {
      defs.push({ name: h.name, type: 'histogram', help: h.help, labels: [] })
    }
    return defs
  }

  /**
   * Render all metrics in Prometheus text exposition format.
   */
  renderPrometheus(): string {
    const lines: string[] = []

    for (const counter of this.counters.values()) {
      lines.push(`# HELP ${counter.name} ${counter.help}`)
      lines.push(`# TYPE ${counter.name} counter`)
      lines.push(`${counter.name} ${counter.get()}`)
    }

    for (const gauge of this.gauges.values()) {
      lines.push(`# HELP ${gauge.name} ${gauge.help}`)
      lines.push(`# TYPE ${gauge.name} gauge`)
      lines.push(`${gauge.name} ${gauge.get()}`)
    }

    for (const histogram of this.histograms.values()) {
      lines.push(`# HELP ${histogram.name} ${histogram.help}`)
      lines.push(`# TYPE ${histogram.name} histogram`)
      lines.push(`${histogram.name}_count ${histogram.count()}`)
      lines.push(`${histogram.name}_sum ${histogram.sum()}`)
    }

    return lines.join('\n') + '\n'
  }

  /**
   * Reset all metrics (test teardown).
   */
  reset(): void {
    for (const c of this.counters.values()) c.reset()
    for (const g of this.gauges.values()) g.reset()
    for (const h of this.histograms.values()) h.reset()
  }

  /**
   * Clear all metric registrations.
   */
  clear(): void {
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
  }
}

// ── Global Registry ─────────────────────────────────────────────────────────

/** Default global metrics registry */
export const globalRegistry = new MetricsRegistry()
