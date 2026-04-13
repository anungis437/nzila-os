import { describe, it, expect, beforeEach } from 'vitest'
import { Counter, Gauge, Histogram, MetricsRegistry, globalRegistry } from '../metrics'

describe('Counter', () => {
  let counter: Counter

  beforeEach(() => {
    counter = new Counter('test_counter', 'A test counter')
  })

  it('should start at zero', () => {
    expect(counter.get()).toBe(0)
  })

  it('should increment by 1 by default', () => {
    counter.inc()
    expect(counter.get()).toBe(1)
  })

  it('should increment by a custom delta', () => {
    counter.inc(5)
    expect(counter.get()).toBe(5)
  })

  it('should reject negative increments', () => {
    expect(() => counter.inc(-1)).toThrow()
  })

  it('should reset to zero', () => {
    counter.inc(10)
    counter.reset()
    expect(counter.get()).toBe(0)
  })

  it('should record samples', () => {
    counter.inc(3)
    counter.inc(2)
    const samples = counter.samples()
    expect(samples.length).toBe(2)
    expect(samples[0]!.value).toBe(3)
    expect(samples[1]!.value).toBe(2)
  })
})

describe('Gauge', () => {
  let gauge: Gauge

  beforeEach(() => {
    gauge = new Gauge('test_gauge', 'A test gauge')
  })

  it('should start at zero', () => {
    expect(gauge.get()).toBe(0)
  })

  it('should set value', () => {
    gauge.set(42)
    expect(gauge.get()).toBe(42)
  })

  it('should increment', () => {
    gauge.set(10)
    gauge.inc(5)
    expect(gauge.get()).toBe(15)
  })

  it('should decrement', () => {
    gauge.set(10)
    gauge.dec(3)
    expect(gauge.get()).toBe(7)
  })

  it('should reset to zero', () => {
    gauge.set(9)
    gauge.reset()
    expect(gauge.get()).toBe(0)
  })
})

describe('Histogram', () => {
  let histogram: Histogram

  beforeEach(() => {
    histogram = new Histogram('test_histogram', 'A test histogram', [10, 50, 100, 500])
  })

  it('should sort custom buckets ascending', () => {
    const custom = new Histogram('custom_histogram', 'Custom histogram', [100, 10, 50])
    expect(custom.buckets).toEqual([10, 50, 100])
  })

  it('should record observations', () => {
    histogram.observe(25)
    histogram.observe(75)
    histogram.observe(200)
    expect(histogram.count()).toBe(3)
    expect(histogram.sum()).toBe(300)
  })

  it('should calculate percentiles', () => {
    for (let i = 1; i <= 100; i++) {
      histogram.observe(i)
    }
    // p50 ≈ 50, p99 ≈ 99
    expect(histogram.percentile(0.5)).toBeGreaterThanOrEqual(45)
    expect(histogram.percentile(0.5)).toBeLessThanOrEqual(55)
    expect(histogram.percentile(0.99)).toBeGreaterThanOrEqual(95)
  })

  it('should return 0 for percentile on empty histogram', () => {
    expect(histogram.percentile(0.5)).toBe(0)
  })

  it('should use default buckets when not provided', () => {
    const withDefaults = new Histogram('default_histogram', 'Default buckets histogram')
    expect(withDefaults.buckets.length).toBeGreaterThan(0)
  })

  it('should reset observations', () => {
    histogram.observe(10)
    histogram.observe(20)
    histogram.reset()
    expect(histogram.count()).toBe(0)
    expect(histogram.sum()).toBe(0)
  })
})

describe('MetricsRegistry', () => {
  let registry: MetricsRegistry

  beforeEach(() => {
    registry = new MetricsRegistry()
  })

  it('should create and retrieve a counter', () => {
    const c = registry.createCounter('http_requests', 'Total HTTP requests')
    c.inc()
    expect(c.get()).toBe(1)
  })

  it('should create and retrieve a gauge', () => {
    const g = registry.createGauge('active_connections', 'Active connections')
    g.set(42)
    expect(g.get()).toBe(42)
  })

  it('should create and retrieve a histogram', () => {
    const h = registry.createHistogram('response_time', 'Response time', [100, 500])
    h.observe(250)
    expect(h.count()).toBe(1)
  })

  it('should list definitions', () => {
    registry.createCounter('c1', 'desc1')
    registry.createGauge('g1', 'desc2')
    const defs = registry.definitions()
    expect(defs.length).toBe(2)
    expect(defs.map((d) => d.name)).toContain('c1')
    expect(defs.map((d) => d.name)).toContain('g1')
  })

  it('should render Prometheus text format', () => {
    const c = registry.createCounter('req_total', 'Total requests')
    c.inc(5)
    const text = registry.renderPrometheus()
    expect(text).toContain('# HELP req_total Total requests')
    expect(text).toContain('# TYPE req_total counter')
    expect(text).toContain('req_total 5')
  })

  it('should return existing metric on duplicate name', () => {
    const c1 = registry.createCounter('dup', 'first')
    const c2 = registry.createCounter('dup', 'second')
    expect(c1).toBe(c2)
  })

  it('should return existing gauge and histogram on duplicate names', () => {
    const g1 = registry.createGauge('dup_gauge', 'first')
    const g2 = registry.createGauge('dup_gauge', 'second')
    const h1 = registry.createHistogram('dup_histogram', 'first', [1, 10])
    const h2 = registry.createHistogram('dup_histogram', 'second', [5, 15])

    expect(g1).toBe(g2)
    expect(h1).toBe(h2)
  })

  it('renders gauges and histograms in prometheus format', () => {
    const gaugeMetric = registry.createGauge('inflight', 'Inflight requests')
    gaugeMetric.set(3)

    const histogramMetric = registry.createHistogram('latency_ms', 'Latency in ms', [10, 100])
    histogramMetric.observe(10)
    histogramMetric.observe(30)

    const text = registry.renderPrometheus()
    expect(text).toContain('# TYPE inflight gauge')
    expect(text).toContain('inflight 3')
    expect(text).toContain('# TYPE latency_ms histogram')
    expect(text).toContain('latency_ms_count 2')
    expect(text).toContain('latency_ms_sum 40')
  })

  it('resets and clears registry state', () => {
    const c = registry.createCounter('reset_counter', 'Reset counter')
    const g = registry.createGauge('reset_gauge', 'Reset gauge')
    const h = registry.createHistogram('reset_histogram', 'Reset histogram', [1, 2])

    c.inc(5)
    g.set(8)
    h.observe(3)

    registry.reset()
    expect(c.get()).toBe(0)
    expect(g.get()).toBe(0)
    expect(h.count()).toBe(0)

    registry.clear()
    expect(registry.definitions()).toHaveLength(0)
  })
})

describe('globalRegistry', () => {
  it('should be a MetricsRegistry instance', () => {
    expect(globalRegistry).toBeInstanceOf(MetricsRegistry)
  })
})
