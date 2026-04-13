import { describe, it, expect, beforeEach } from 'vitest'
import { metrics, initMetrics, SLO_DEFINITIONS, type SloDefinition } from '../metrics'

describe('metrics', () => {
  beforeEach(() => {
    metrics.reset()
  })

  describe('initMetrics', () => {
    it('returns the singleton', () => {
      const m = initMetrics('console')
      expect(m).toBe(metrics)
    })

    it('sets app name on subsequent counters', () => {
      initMetrics('console')
      metrics.incrementCounter('test_counter')
      const snap = metrics.getSnapshot()
      expect(snap.counters[0]!.labels.app).toBe('console')
    })
  })

  describe('incrementCounter', () => {
    it('creates a new counter on first call', () => {
      initMetrics('test')
      metrics.incrementCounter('requests', { method: 'GET' })
      const snap = metrics.getSnapshot()
      expect(snap.counters).toHaveLength(1)
      expect(snap.counters[0]!.name).toBe('requests')
      expect(snap.counters[0]!.value).toBe(1)
    })

    it('increments existing counter', () => {
      initMetrics('test')
      metrics.incrementCounter('requests', { method: 'GET' })
      metrics.incrementCounter('requests', { method: 'GET' })
      const snap = metrics.getSnapshot()
      expect(snap.counters).toHaveLength(1)
      expect(snap.counters[0]!.value).toBe(2)
    })

    it('increments by custom value', () => {
      initMetrics('test')
      metrics.incrementCounter('cost', {}, 3.5)
      expect(metrics.getSnapshot().counters[0]!.value).toBe(3.5)
    })

    it('tracks different label sets as separate counters', () => {
      initMetrics('test')
      metrics.incrementCounter('req', { path: '/a' })
      metrics.incrementCounter('req', { path: '/b' })
      expect(metrics.getSnapshot().counters).toHaveLength(2)
    })
  })

  describe('recordHistogram', () => {
    it('creates histogram with bucket counts', () => {
      initMetrics('test')
      metrics.recordHistogram('duration', 250)
      const snap = metrics.getSnapshot()
      expect(snap.histograms).toHaveLength(1)
      expect(snap.histograms[0]!.count).toBe(1)
      expect(snap.histograms[0]!.sum).toBe(250)
    })

    it('updates existing histogram with new value', () => {
      initMetrics('test')
      metrics.recordHistogram('duration', 100)
      metrics.recordHistogram('duration', 300)
      const h = metrics.getSnapshot().histograms[0]!
      expect(h.count).toBe(2)
      expect(h.sum).toBe(400)
    })

    it('uses custom buckets when provided', () => {
      initMetrics('test')
      metrics.recordHistogram('small', 5, {}, [1, 10, 100])
      const h = metrics.getSnapshot().histograms[0]!
      expect(h.buckets).toEqual([1, 10, 100])
      expect(h.counts).toEqual([0, 1, 1]) // 5 > 1, 5 <= 10, 5 <= 100
    })
  })

  describe('convenience methods', () => {
    beforeEach(() => initMetrics('test'))

    it('httpRequest records counter and histogram', () => {
      metrics.httpRequest('GET', '/api/foo', 200, 150)
      const snap = metrics.getSnapshot()
      expect(snap.counters.length).toBeGreaterThanOrEqual(1)
      expect(snap.counters.find((c) => c.name === 'http_requests_total')).toBeDefined()
      expect(snap.histograms.find((h) => h.name === 'http_request_duration_ms')).toBeDefined()
    })

    it('httpRequest records error counter for 5xx', () => {
      metrics.httpRequest('POST', '/api', 500, 100)
      expect(
        metrics.getSnapshot().counters.find((c) => c.name === 'http_errors_total'),
      ).toBeDefined()
    })

    it('aiInference records cost when provided', () => {
      metrics.aiInference('gpt-4', true, 300, 0.05)
      const costCounter = metrics
        .getSnapshot()
        .counters.find((c) => c.name === 'ai_inference_cost_usd')
      expect(costCounter).toBeDefined()
      expect(costCounter!.value).toBe(0.05)
    })

    it('aiInference records error counter on failure', () => {
      metrics.aiInference('gpt-4', false, 100)
      expect(
        metrics.getSnapshot().counters.find((c) => c.name === 'ai_inference_errors_total'),
      ).toBeDefined()
    })

    it('mlInference records metrics', () => {
      metrics.mlInference('model-v1', true, 50)
      expect(
        metrics.getSnapshot().counters.find((c) => c.name === 'ml_inference_total'),
      ).toBeDefined()
    })

    it('mlInference records error on failure', () => {
      metrics.mlInference('model-v1', false, 50)
      expect(
        metrics.getSnapshot().counters.find((c) => c.name === 'ml_inference_errors_total'),
      ).toBeDefined()
    })

    it('webhookProcessed records success and duration', () => {
      metrics.webhookProcessed('stripe', 'invoice.paid', true, 200)
      const snap = metrics.getSnapshot()
      expect(snap.counters.find((c) => c.name === 'webhook_total')).toBeDefined()
      expect(snap.histograms.find((h) => h.name === 'webhook_duration_ms')).toBeDefined()
    })

    it('webhookProcessed records error on failure', () => {
      metrics.webhookProcessed('stripe', 'payment_intent.failed', false, 100)
      expect(
        metrics.getSnapshot().counters.find((c) => c.name === 'webhook_errors_total'),
      ).toBeDefined()
    })

    it('qboSync records metrics', () => {
      metrics.qboSync('invoice-sync', true, 500)
      expect(
        metrics.getSnapshot().counters.find((c) => c.name === 'qbo_sync_total'),
      ).toBeDefined()
    })

    it('qboSync records error on failure', () => {
      metrics.qboSync('invoice-sync', false, 500)
      expect(
        metrics.getSnapshot().counters.find((c) => c.name === 'qbo_sync_errors_total'),
      ).toBeDefined()
    })

    it('reconciliation records mismatch counter', () => {
      metrics.reconciliation('bank-rec', false, 500)
      expect(
        metrics.getSnapshot().counters.find((c) => c.name === 'reconciliation_mismatches_total'),
      ).toBeDefined()
    })

    it('reconciliation records delta histogram', () => {
      metrics.reconciliation('bank-rec', true, 250)
      expect(
        metrics.getSnapshot().histograms.find((h) => h.name === 'reconciliation_delta_cents'),
      ).toBeDefined()
    })
  })

  describe('getSnapshot / reset', () => {
    it('reset clears all counters and histograms', () => {
      initMetrics('test')
      metrics.incrementCounter('x')
      metrics.recordHistogram('y', 1)
      expect(metrics.getSnapshot().counters).toHaveLength(1)
      metrics.reset()
      expect(metrics.getSnapshot().counters).toHaveLength(0)
      expect(metrics.getSnapshot().histograms).toHaveLength(0)
    })
  })

  describe('SLO_DEFINITIONS', () => {
    it('has definitions for key services', () => {
      const services = [...new Set(SLO_DEFINITIONS.map((s) => s.service))]
      expect(services).toContain('console')
      expect(services).toContain('union-eyes')
      expect(services).toContain('stripe-webhooks')
    })

    it('all definitions have valid targets', () => {
      for (const slo of SLO_DEFINITIONS) {
        expect(slo.target).toBeGreaterThan(0)
        expect(slo.target).toBeLessThanOrEqual(100)
        expect(slo.windowHours).toBeGreaterThan(0)
      }
    })
  })
})
