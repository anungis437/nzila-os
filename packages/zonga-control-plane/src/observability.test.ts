import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordMetric,
  onMetric,
  getMetrics,
  clearMetrics,
  generateCorrelationId,
  emitLog,
  onLog,
  MetricName,
  type StructuredLog,
} from './observability'

describe('@nzila/zonga-control-plane — Observability', () => {
  beforeEach(() => {
    clearMetrics()
  })

  // ── Metrics ───────────────────────────────────────────────────────

  describe('recordMetric', () => {
    it('stores metric in buffer', () => {
      recordMetric(MetricName.PAYOUT_AMOUNT_TOTAL, 500)
      const metrics = getMetrics(MetricName.PAYOUT_AMOUNT_TOTAL)
      expect(metrics).toHaveLength(1)
      expect(metrics[0]!.value).toBe(500)
    })

    it('includes labels and timestamp', () => {
      recordMetric(MetricName.WORKFLOW_EXECUTIONS_TOTAL, 1, { workflow: 'refund' })
      const metrics = getMetrics(MetricName.WORKFLOW_EXECUTIONS_TOTAL)
      expect(metrics[0]!.labels['workflow']).toBe('refund')
      expect(metrics[0]!.timestamp).toBeInstanceOf(Date)
    })

    it('delivers to registered handlers', () => {
      const received: { name: string; value: number }[] = []
      const unsub = onMetric((m) => received.push({ name: m.name, value: m.value }))

      recordMetric(MetricName.FRAUD_SIGNALS_DETECTED, 3)

      expect(received).toHaveLength(1)
      expect(received[0]!.name).toBe(MetricName.FRAUD_SIGNALS_DETECTED)
      unsub()
    })

    it('does not crash when handler throws', () => {
      const unsub = onMetric(() => { throw new Error('boom') })
      expect(() => recordMetric(MetricName.AUDIT_EVENTS_TOTAL, 1)).not.toThrow()
      unsub()
    })
  })

  describe('onMetric', () => {
    it('stops receiving after unsubscribe', () => {
      let count = 0
      const unsub = onMetric(() => { count++ })

      recordMetric(MetricName.PAYOUT_LATENCY_MS, 100)
      expect(count).toBe(1)

      unsub()
      recordMetric(MetricName.PAYOUT_LATENCY_MS, 200)
      expect(count).toBe(1) // unchanged
    })
  })

  describe('getMetrics', () => {
    it('returns all metrics when no filter', () => {
      recordMetric(MetricName.PAYOUT_AMOUNT_TOTAL, 100)
      recordMetric(MetricName.FRAUD_SIGNALS_DETECTED, 2)

      const all = getMetrics()
      expect(all.length).toBeGreaterThanOrEqual(2)
    })

    it('filters by metric name', () => {
      recordMetric(MetricName.PAYOUT_AMOUNT_TOTAL, 100)
      recordMetric(MetricName.FRAUD_SIGNALS_DETECTED, 2)

      const payoutMetrics = getMetrics(MetricName.PAYOUT_AMOUNT_TOTAL)
      expect(payoutMetrics).toHaveLength(1)
      expect(payoutMetrics[0]!.value).toBe(100)
    })
  })

  describe('clearMetrics', () => {
    it('empties the metric buffer', () => {
      recordMetric(MetricName.AUDIT_EVENTS_TOTAL, 10)
      clearMetrics()
      expect(getMetrics()).toHaveLength(0)
    })
  })

  // ── Correlation IDs ───────────────────────────────────────────────

  describe('generateCorrelationId', () => {
    it('generates unique IDs', () => {
      const a = generateCorrelationId()
      const b = generateCorrelationId()
      expect(a).not.toBe(b)
    })

    it('uses provided prefix', () => {
      const id = generateCorrelationId('test')
      expect(id.startsWith('test_')).toBe(true)
    })

    it('uses default prefix', () => {
      const id = generateCorrelationId()
      expect(id.startsWith('zonga_')).toBe(true)
    })
  })

  // ── Structured Logging ────────────────────────────────────────────

  describe('emitLog', () => {
    it('delivers log to registered handlers', () => {
      const logs: StructuredLog[] = []
      const unsub = onLog((log) => logs.push(log))

      emitLog({
        level: 'info',
        message: 'Payout executed',
        correlationId: 'corr-1',
        orgId: 'org-1',
      })

      expect(logs).toHaveLength(1)
      expect(logs[0]!.message).toBe('Payout executed')
      expect(logs[0]!.timestamp).toBeInstanceOf(Date)
      unsub()
    })

    it('does not crash when handler throws', () => {
      const unsub = onLog(() => { throw new Error('log boom') })
      expect(() =>
        emitLog({ level: 'error', message: 'test', correlationId: 'c-1' }),
      ).not.toThrow()
      unsub()
    })
  })

  describe('onLog', () => {
    it('stops receiving after unsubscribe', () => {
      let count = 0
      const unsub = onLog(() => { count++ })

      emitLog({ level: 'info', message: 'a', correlationId: 'c' })
      expect(count).toBe(1)

      unsub()
      emitLog({ level: 'info', message: 'b', correlationId: 'c' })
      expect(count).toBe(1)
    })
  })
})
