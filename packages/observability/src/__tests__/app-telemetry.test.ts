/**
 * @nzila/observability — App Telemetry Factory tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAppTelemetry, type AppTelemetryConfig } from '../app-telemetry'

describe('createAppTelemetry', () => {
  it('creates a telemetry stack with correct appId', () => {
    const sink = vi.fn()
    const t = createAppTelemetry('union-eyes', { sink })
    expect(t.appId).toBe('union-eyes')
  })

  it('logger is bound to service name nzila-<appId>', () => {
    const sink = vi.fn()
    const t = createAppTelemetry('console', { sink })
    t.logger.info('test.event')
    expect(sink).toHaveBeenCalledTimes(1)
    const entry = sink.mock.calls[0][0]
    expect(entry.metadata.service).toBe('nzila-console')
  })

  it('metricName scopes metric to nzila.<appId>.<name>', () => {
    const t = createAppTelemetry('flow')
    expect(t.metricName('claims_processed')).toBe('nzila.flow.claims_processed')
  })

  it('trackMetric logs a metric.recorded event with value and dimensions', () => {
    const sink = vi.fn()
    const t = createAppTelemetry('cfo', { sink })
    t.trackMetric('invoices_sent', 5, { region: 'east' })
    expect(sink).toHaveBeenCalledTimes(1)
    const entry = sink.mock.calls[0][0]
    expect(entry.event).toBe('metric.recorded')
    expect(entry.metadata.metric).toBe('nzila.cfo.invoices_sent')
    expect(entry.metadata.value).toBe(5)
    expect(entry.metadata.region).toBe('east')
  })

  it('trackMetric works without dimensions', () => {
    const sink = vi.fn()
    const t = createAppTelemetry('web', { sink })
    t.trackMetric('page_views', 1)
    const entry = sink.mock.calls[0][0]
    expect(entry.metadata.value).toBe(1)
  })

  it('startTimer returns a function that reports durationMs', () => {
    const sink = vi.fn()
    const t = createAppTelemetry('trade', { sink })
    const stop = t.startTimer('db.query')
    // Simulate some delay
    const duration = stop()
    expect(typeof duration).toBe('number')
    expect(duration).toBeGreaterThanOrEqual(0)
    expect(sink).toHaveBeenCalledTimes(1)
    const entry = sink.mock.calls[0][0]
    expect(entry.event).toBe('operation.completed')
    expect(entry.metadata.operation).toBe('db.query')
    expect(entry.metadata.durationMs).toBe(duration)
  })

  it('generateRequestId returns a UUID', () => {
    const t = createAppTelemetry('zonga')
    const id = t.generateRequestId()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('uses default minLevel info', () => {
    const sink = vi.fn()
    const t = createAppTelemetry('abr', { sink })
    t.logger.debug('hidden')
    expect(sink).not.toHaveBeenCalled()
    t.logger.info('visible')
    expect(sink).toHaveBeenCalledTimes(1)
  })

  it('respects custom minLevel', () => {
    const sink = vi.fn()
    const t = createAppTelemetry('web', { sink, minLevel: 'warn' })
    t.logger.info('hidden')
    expect(sink).not.toHaveBeenCalled()
    t.logger.warn('visible')
    expect(sink).toHaveBeenCalledTimes(1)
  })

  it('includes staticMetadata in all log entries', () => {
    const sink = vi.fn()
    const t = createAppTelemetry('flow', {
      sink,
      staticMetadata: { version: '1.2.3', region: 'us-east' },
    })
    t.logger.info('boot')
    const entry = sink.mock.calls[0][0]
    expect(entry.metadata.version).toBe('1.2.3')
    expect(entry.metadata.region).toBe('us-east')
  })

  it('works without config (defaults)', () => {
    // Should not throw
    const t = createAppTelemetry('cora')
    expect(t.appId).toBe('cora')
    expect(t.metricName('x')).toBe('nzila.cora.x')
  })
})
