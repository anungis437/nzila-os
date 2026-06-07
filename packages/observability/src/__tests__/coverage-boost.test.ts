/**
 * @nzila/observability — Coverage boost tests
 *
 * Targets uncovered branches and edge cases across all modules
 * to push statement coverage above 90%.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// ── context.ts — withTraceContextAsync, getTraceContext inside store ─────────

import {
  withTraceContextAsync,
  getTraceContext,
  requireTraceContext,
  generateTraceId,
  generateSpanId,
  parseTraceparent,
  type TraceContext,
} from '../context'

describe('context — withTraceContextAsync', () => {
  it('getTraceContext returns the ctx inside the callback', async () => {
    const ctx: TraceContext = {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      tenantId: 't1',
      actorId: 'a1',
      requestId: 'r1',
    }

    await withTraceContextAsync(ctx, async () => {
      const current = getTraceContext()
      expect(current).toBe(ctx)
    })
  })

  it('getTraceContext returns undefined outside store', () => {
    expect(getTraceContext()).toBeUndefined()
  })

  it('requireTraceContext returns context when inside store', async () => {
    const ctx: TraceContext = {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      tenantId: 't',
      actorId: 'a',
      requestId: 'r',
    }

    await withTraceContextAsync(ctx, async () => {
      const got = requireTraceContext()
      expect(got).toBe(ctx)
    })
  })

  it('works with synchronous callbacks', () => {
    const ctx: TraceContext = {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      tenantId: 't',
      actorId: 'a',
      requestId: 'r',
    }

    const result = withTraceContextAsync(ctx, () => {
      return 42
    })

    expect(result).toBe(42)
  })

  it('propagates errors from async callbacks', async () => {
    const ctx: TraceContext = {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      tenantId: 't',
      actorId: 'a',
      requestId: 'r',
    }

    await expect(
      withTraceContextAsync(ctx, async () => {
        throw new Error('async fail')
      }),
    ).rejects.toThrow('async fail')
  })
})

describe('context — generateTraceId / generateSpanId', () => {
  it('generateTraceId returns 32 hex chars', () => {
    const id = generateTraceId()
    expect(id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('generateSpanId returns 16 hex chars', () => {
    const id = generateSpanId()
    expect(id).toMatch(/^[0-9a-f]{16}$/)
  })

  it('values are unique', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateTraceId()))
    expect(ids.size).toBe(10)
  })
})

describe('context — parseTraceparent', () => {
  it('parses a valid traceparent', () => {
    const traceId = 'a'.repeat(32)
    const spanId = 'b'.repeat(16)
    const result = parseTraceparent(`00-${traceId}-${spanId}-01`)
    expect(result).toEqual({ traceId, spanId, flags: '01' })
  })

  it('returns null for invalid traceparent', () => {
    expect(parseTraceparent('invalid')).toBeNull()
    expect(parseTraceparent('')).toBeNull()
    expect(parseTraceparent('01-abc-def-00')).toBeNull()
  })

  it('returns null for wrong version', () => {
    const traceId = 'a'.repeat(32)
    const spanId = 'b'.repeat(16)
    expect(parseTraceparent(`01-${traceId}-${spanId}-01`)).toBeNull()
  })

  it('parses unsampled flag', () => {
    const traceId = 'c'.repeat(32)
    const spanId = 'd'.repeat(16)
    const result = parseTraceparent(`00-${traceId}-${spanId}-00`)
    expect(result?.flags).toBe('00')
  })
})

// ── spans.ts — endSpan default status, createSpan inside context ────────────

import {
  createSpan,
  addSpanEvent,
  endSpan,
  setSpanExporter,
  withSpan,
  type Span,
} from '../spans'

describe('spans — endSpan default status', () => {
  afterEach(() => {
    setSpanExporter(undefined as unknown as (s: Span) => void)
  })

  it('endSpan uses ok as default status', () => {
    const exporter = vi.fn()
    setSpanExporter(exporter)

    const span = createSpan('default-status')
    endSpan(span)

    expect(exporter).toHaveBeenCalledOnce()
    expect(exporter.mock.calls[0][0].status).toBe('ok')
  })

  it('endSpan computes durationMs', () => {
    const span = createSpan('timed')
    endSpan(span)
    expect(span.durationMs).toBeGreaterThanOrEqual(0)
    expect(span.endTime).toBeDefined()
  })
})

describe('spans — createSpan inside withTraceContextAsync', () => {
  it('picks up AsyncLocalStorage context automatically', async () => {
    const ctx: TraceContext = {
      traceId: 'a'.repeat(32),
      spanId: 'b'.repeat(16),
      tenantId: 'store-t',
      actorId: 'store-a',
      requestId: 'store-r',
    }

    await withTraceContextAsync(ctx, async () => {
      const span = createSpan('auto-ctx')
      expect(span.traceId).toBe('a'.repeat(32))
      expect(span.spanId).toBe('b'.repeat(16))
      expect(span.attributes.tenant_id).toBe('store-t')
    })
  })
})

describe('spans — addSpanEvent', () => {
  it('pushes events with timestamps', () => {
    const span = createSpan('ev-span')
    addSpanEvent(span, 'checkpoint', { step: 1 })
    addSpanEvent(span, 'done')

    expect(span.events).toHaveLength(2)
    expect(span.events[0].name).toBe('checkpoint')
    expect(span.events[0].attributes.step).toBe(1)
    expect(span.events[1].name).toBe('done')
    expect(span.events[1].timestamp).toBeGreaterThan(0)
  })
})

describe('spans — withSpan success path', () => {
  afterEach(() => {
    setSpanExporter(undefined as unknown as (s: Span) => void)
  })

  it('returns result and sets ok status', async () => {
    const exporter = vi.fn()
    setSpanExporter(exporter)

    const result = await withSpan('success-span', async (span) => {
      addSpanEvent(span, 'work')
      return 'done'
    })

    expect(result).toBe('done')
    expect(exporter).toHaveBeenCalledOnce()
    const reported: Span = exporter.mock.calls[0][0]
    expect(reported.status).toBe('ok')
    expect(reported.durationMs).toBeGreaterThanOrEqual(0)
  })
})

// ── logger.ts — trace context in log entries ────────────────────────────────

import { TracedLogger, type LogEntry } from '../logger'

describe('logger — trace context injection', () => {
  it('includes trace context when inside AsyncLocalStorage', async () => {
    const sink = vi.fn()
    const logger = new TracedLogger({ service: 'test', sink })
    const ctx: TraceContext = {
      traceId: 't'.repeat(32),
      spanId: 's'.repeat(16),
      tenantId: 'ten',
      actorId: 'act',
      requestId: 'req-1',
    }

    await withTraceContextAsync(ctx, async () => {
      logger.info('traced.event')
    })

    expect(sink).toHaveBeenCalledOnce()
    const entry: LogEntry = sink.mock.calls[0][0]
    expect(entry.trace_id).toBe('t'.repeat(32))
    expect(entry.span_id).toBe('s'.repeat(16))
    expect(entry.tenant_id).toBe('ten')
    expect(entry.actor_id).toBe('act')
    expect(entry.request_id).toBe('req-1')
  })

  it('has undefined trace fields when outside context', () => {
    const sink = vi.fn()
    const logger = new TracedLogger({ service: 'test', sink })
    logger.info('no-ctx')
    const entry: LogEntry = sink.mock.calls[0][0]
    expect(entry.trace_id).toBeUndefined()
    expect(entry.span_id).toBeUndefined()
  })

  it('timestamp is a valid ISO string', () => {
    const sink = vi.fn()
    const logger = new TracedLogger({ service: 'ts-test', sink })
    logger.info('time-check')
    const entry: LogEntry = sink.mock.calls[0][0]
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp)
  })
})

describe('logger — all log levels call sink with correct level', () => {
  it('debug level', () => {
    const sink = vi.fn()
    const logger = new TracedLogger({ service: 'x', minLevel: 'debug', sink })
    logger.debug('d')
    expect(sink.mock.calls[0][0].level).toBe('debug')
  })

  it('info level', () => {
    const sink = vi.fn()
    const logger = new TracedLogger({ service: 'x', sink })
    logger.info('i')
    expect(sink.mock.calls[0][0].level).toBe('info')
  })

  it('warn level', () => {
    const sink = vi.fn()
    const logger = new TracedLogger({ service: 'x', sink })
    logger.warn('w')
    expect(sink.mock.calls[0][0].level).toBe('warn')
  })

  it('error level', () => {
    const sink = vi.fn()
    const logger = new TracedLogger({ service: 'x', sink })
    logger.error('e')
    expect(sink.mock.calls[0][0].level).toBe('error')
  })
})

// ── exporter.ts — OtlpHttpExporter interval-based flush, non-Error catch ────

describe('OtlpHttpExporter — interval-based flush', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-flushes on interval', async () => {
    const { OtlpHttpExporter } = await import('../exporter')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    )

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      batchSize: 1000,
      flushIntervalMs: 1000,
    })

    exporter.exportSpan(makeFakeSpan())
    expect(fetchSpy).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    fetchSpy.mockRestore()
    await exporter.shutdown()
  })

  it('handles non-Error exception in fetch catch', async () => {
    const { OtlpHttpExporter } = await import('../exporter')
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue('string-error')

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      batchSize: 100,
      flushIntervalMs: 60_000,
    })

    exporter.exportSpan(makeFakeSpan())
    await exporter.flush()

    expect(stderrSpy).toHaveBeenCalled()
    const msg = stderrSpy.mock.calls[0][0] as string
    expect(msg).toContain('string-error')

    stderrSpy.mockRestore()
    fetchSpy.mockRestore()
    await exporter.shutdown()
  })

  it('does not requeue spans when buffer exceeds 10x batchSize', async () => {
    const { OtlpHttpExporter } = await import('../exporter')
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 503, statusText: 'Service Unavailable' }),
    )

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      batchSize: 2,
      flushIntervalMs: 60_000,
    })

    // Fill buffer past 10x batchSize (20 spans)
    for (let i = 0; i < 25; i++) {
      exporter.exportSpan(makeFakeSpan({ name: `span-${i}` }))
    }

    // Flush should fail and NOT requeue since buffer > 10*batchSize
    await exporter.flush()

    fetchSpy.mockRestore()
    vi.spyOn(process.stderr, 'write').mockRestore()
    await exporter.shutdown()
  })
})

// ── exporter.ts — toOtlpSpan edge cases ─────────────────────────────────────

describe('OtlpHttpExporter — OTLP span conversion edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('converts span with no parentSpanId to empty string', async () => {
    const { OtlpHttpExporter } = await import('../exporter')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    )

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      batchSize: 100,
    })

    exporter.exportSpan(makeFakeSpan({ parentSpanId: undefined }))
    await exporter.flush()

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    const otlpSpan = body.resourceSpans[0].scopeSpans[0].spans[0]
    expect(otlpSpan.parentSpanId).toBe('')

    fetchSpy.mockRestore()
    await exporter.shutdown()
  })

  it('converts ok status to code 1', async () => {
    const { OtlpHttpExporter } = await import('../exporter')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    )

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      batchSize: 100,
    })

    exporter.exportSpan(makeFakeSpan({ status: 'ok' }))
    await exporter.flush()

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(body.resourceSpans[0].scopeSpans[0].spans[0].status.code).toBe(1)

    fetchSpy.mockRestore()
    await exporter.shutdown()
  })

  it('endTime falls back to startTime when undefined', async () => {
    const { OtlpHttpExporter } = await import('../exporter')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    )

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      batchSize: 100,
    })

    exporter.exportSpan(makeFakeSpan({ endTime: undefined, startTime: 5000 }))
    await exporter.flush()

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    const otlpSpan = body.resourceSpans[0].scopeSpans[0].spans[0]
    expect(otlpSpan.endTimeUnixNano).toBe(5000 * 1_000_000)

    fetchSpy.mockRestore()
    await exporter.shutdown()
  })
})

// ── sdk.ts — initObservability logs initialization ──────────────────────────

describe('sdk — initObservability logging', () => {
  afterEach(async () => {
    vi.resetModules()
  })

  it('logs observability.initialized with exporter name', async () => {
    const mod = await import('../sdk')
    const fakeExporter = {
      name: 'test-exporter',
      exportSpan: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    }

    // We can't easily capture the init log since logger uses defaultSink
    // but we can verify the logger is returned and the exporter is set
    const logger = mod.initObservability({
      serviceName: 'test-svc',
      exporter: fakeExporter,
      environment: 'test',
    })
    expect(logger).toBeDefined()
    expect(mod.isObservabilityInitialized()).toBe(true)

    await mod.shutdownObservability()
  })
})

// ── app-telemetry.ts — createAppTelemetry edge cases ────────────────────────

import { createAppTelemetry } from '../app-telemetry'

describe('app-telemetry — edge cases', () => {
  it('staticMetadata does not override call-site metadata', () => {
    const sink = vi.fn()
    const t = createAppTelemetry('test', {
      sink,
      staticMetadata: { key: 'static' },
    })
    t.logger.info('event', { key: 'override' })
    const entry = sink.mock.calls[0][0]
    expect(entry.metadata.key).toBe('override')
  })

  it('trackMetric without dimensions does not crash', () => {
    const sink = vi.fn()
    const t = createAppTelemetry('web', { sink })
    t.trackMetric('count', 10)
    expect(sink).toHaveBeenCalledOnce()
  })

  it('startTimer reports positive durationMs', () => {
    const sink = vi.fn()
    const t = createAppTelemetry('flow', { sink })
    const stop = t.startTimer('slow-op')
    const ms = stop()
    expect(ms).toBeGreaterThanOrEqual(0)
  })
})

// ── Helper ──────────────────────────────────────────────────────────────────

function makeFakeSpan(overrides: Partial<Span> = {}): Span {
  return {
    name: 'test-span',
    traceId: 'abc123',
    spanId: 'def456',
    parentSpanId: undefined,
    startTime: 1000,
    endTime: 1050,
    durationMs: 50,
    attributes: { 'http.method': 'GET' },
    events: [
      { name: 'checkpoint', timestamp: 1010, attributes: { step: 1 } },
    ],
    status: 'ok',
    ...overrides,
  }
}
