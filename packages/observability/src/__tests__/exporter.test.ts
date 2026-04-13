/**
 * @nzila/observability — Exporter tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ConsoleExporter, OtlpHttpExporter, MultiExporter } from '../exporter'
import type { Span } from '../spans'

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
      {
        name: 'checkpoint',
        timestamp: 1010,
        attributes: { step: 1 },
      },
    ],
    status: 'ok',
    ...overrides,
  }
}

// ── ConsoleExporter ─────────────────────────────────────────────────────────

describe('ConsoleExporter', () => {
  it('has name "console"', () => {
    const exporter = new ConsoleExporter()
    expect(exporter.name).toBe('console')
  })

  it('writes span JSON to stdout', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const exporter = new ConsoleExporter()
    const span = makeFakeSpan()

    exporter.exportSpan(span)

    expect(writeSpy).toHaveBeenCalledTimes(1)
    const output = writeSpy.mock.calls[0][0] as string
    expect(output).toContain('[SPAN]')
    expect(output).toContain('test-span')
    expect(output).toContain('abc123')
    writeSpy.mockRestore()
  })

  it('includes all span fields in output', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const exporter = new ConsoleExporter()
    exporter.exportSpan(makeFakeSpan({ parentSpanId: 'parent-1', status: 'error' }))

    const parsed = JSON.parse((writeSpy.mock.calls[0][0] as string).replace('[SPAN] ', ''))
    expect(parsed.name).toBe('test-span')
    expect(parsed.parentSpanId).toBe('parent-1')
    expect(parsed.status).toBe('error')
    expect(parsed.durationMs).toBe(50)
    expect(parsed.events).toHaveLength(1)
    writeSpy.mockRestore()
  })

  it('flush is a no-op', async () => {
    const exporter = new ConsoleExporter()
    await expect(exporter.flush()).resolves.toBeUndefined()
  })

  it('shutdown is a no-op', async () => {
    const exporter = new ConsoleExporter()
    await expect(exporter.shutdown()).resolves.toBeUndefined()
  })
})

// ── OtlpHttpExporter ────────────────────────────────────────────────────────

describe('OtlpHttpExporter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('has name "otlp-http"', () => {
    const exporter = new OtlpHttpExporter({ endpoint: 'http://localhost:4318/v1/traces' })
    expect(exporter.name).toBe('otlp-http')
    // Cleanup
    void exporter.shutdown()
  })

  it('buffers spans until batch size', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    )

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      batchSize: 2,
      flushIntervalMs: 60_000,
    })

    // First span — should NOT trigger flush
    exporter.exportSpan(makeFakeSpan({ name: 'span-1' }))
    expect(fetchSpy).not.toHaveBeenCalled()

    // Second span — hits batch size, triggers flush
    exporter.exportSpan(makeFakeSpan({ name: 'span-2' }))

    // Wait for async flush
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toBe('http://localhost:4318/v1/traces')
    expect(options?.method).toBe('POST')
    expect(options?.headers).toMatchObject({ 'Content-Type': 'application/json' })

    fetchSpy.mockRestore()
    await exporter.shutdown()
  })

  it('flush sends buffered spans', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    )

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      batchSize: 100,
      flushIntervalMs: 60_000,
    })

    exporter.exportSpan(makeFakeSpan())
    await exporter.flush()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(body.resourceSpans).toHaveLength(1)
    expect(body.resourceSpans[0].scopeSpans[0].spans).toHaveLength(1)

    fetchSpy.mockRestore()
    await exporter.shutdown()
  })

  it('flush is no-op when buffer is empty', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    )

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      batchSize: 100,
      flushIntervalMs: 60_000,
    })

    await exporter.flush()
    expect(fetchSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
    await exporter.shutdown()
  })

  it('handles export errors gracefully', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('Network error'),
    )

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      batchSize: 100,
      flushIntervalMs: 60_000,
    })

    exporter.exportSpan(makeFakeSpan())
    await exporter.flush()

    expect(stderrSpy).toHaveBeenCalled()
    const msg = stderrSpy.mock.calls[0][0] as string
    expect(msg).toContain('[OTLP] Export error')
    expect(msg).toContain('Network error')

    stderrSpy.mockRestore()
    fetchSpy.mockRestore()
    await exporter.shutdown()
  })

  it('requeues spans on non-OK response (bounded)', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 503, statusText: 'Service Unavailable' }),
    )

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      batchSize: 100,
      flushIntervalMs: 60_000,
    })

    exporter.exportSpan(makeFakeSpan())
    await exporter.flush()

    expect(stderrSpy).toHaveBeenCalled()
    const msg = stderrSpy.mock.calls[0][0] as string
    expect(msg).toContain('[OTLP] Export failed: 503')

    stderrSpy.mockRestore()
    fetchSpy.mockRestore()
    await exporter.shutdown()
  })

  it('passes custom headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    )

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      headers: { Authorization: 'Bearer token123' },
      batchSize: 100,
    })

    exporter.exportSpan(makeFakeSpan())
    await exporter.flush()

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token123')

    fetchSpy.mockRestore()
    await exporter.shutdown()
  })

  it('shutdown clears interval and flushes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    )

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      batchSize: 100,
      flushIntervalMs: 60_000,
    })

    exporter.exportSpan(makeFakeSpan())
    await exporter.shutdown()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    fetchSpy.mockRestore()
  })

  it('converts span attributes to OTLP format', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    )

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      batchSize: 100,
    })

    exporter.exportSpan(makeFakeSpan({
      attributes: {
        str_attr: 'hello',
        num_attr: 42,
        bool_attr: true,
      },
      status: 'error',
    }))
    await exporter.flush()

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    const otlpSpan = body.resourceSpans[0].scopeSpans[0].spans[0]
    expect(otlpSpan.status.code).toBe(2) // error
    expect(otlpSpan.attributes).toEqual(
      expect.arrayContaining([
        { key: 'str_attr', value: { stringValue: 'hello' } },
        { key: 'num_attr', value: { intValue: 42 } },
        { key: 'bool_attr', value: { boolValue: true } },
      ]),
    )

    fetchSpy.mockRestore()
    await exporter.shutdown()
  })

  it('converts span with unset status', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    )

    const exporter = new OtlpHttpExporter({
      endpoint: 'http://localhost:4318/v1/traces',
      batchSize: 100,
    })

    exporter.exportSpan(makeFakeSpan({ status: 'unset', endTime: undefined }))
    await exporter.flush()

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    const otlpSpan = body.resourceSpans[0].scopeSpans[0].spans[0]
    expect(otlpSpan.status.code).toBe(0) // unset

    fetchSpy.mockRestore()
    await exporter.shutdown()
  })
})

// ── MultiExporter ───────────────────────────────────────────────────────────

describe('MultiExporter', () => {
  it('has name "multi"', () => {
    const me = new MultiExporter([])
    expect(me.name).toBe('multi')
  })

  it('delegates exportSpan to all child exporters', () => {
    const exp1 = { name: 'e1', exportSpan: vi.fn(), flush: vi.fn(), shutdown: vi.fn() }
    const exp2 = { name: 'e2', exportSpan: vi.fn(), flush: vi.fn(), shutdown: vi.fn() }
    const me = new MultiExporter([exp1, exp2])
    const span = makeFakeSpan()

    me.exportSpan(span)

    expect(exp1.exportSpan).toHaveBeenCalledWith(span)
    expect(exp2.exportSpan).toHaveBeenCalledWith(span)
  })

  it('flush calls flush on all children', async () => {
    const exp1 = { name: 'e1', exportSpan: vi.fn(), flush: vi.fn().mockResolvedValue(undefined), shutdown: vi.fn() }
    const exp2 = { name: 'e2', exportSpan: vi.fn(), flush: vi.fn().mockResolvedValue(undefined), shutdown: vi.fn() }
    const me = new MultiExporter([exp1, exp2])

    await me.flush()

    expect(exp1.flush).toHaveBeenCalled()
    expect(exp2.flush).toHaveBeenCalled()
  })

  it('shutdown calls shutdown on all children', async () => {
    const exp1 = { name: 'e1', exportSpan: vi.fn(), flush: vi.fn(), shutdown: vi.fn().mockResolvedValue(undefined) }
    const exp2 = { name: 'e2', exportSpan: vi.fn(), flush: vi.fn(), shutdown: vi.fn().mockResolvedValue(undefined) }
    const me = new MultiExporter([exp1, exp2])

    await me.shutdown()

    expect(exp1.shutdown).toHaveBeenCalled()
    expect(exp2.shutdown).toHaveBeenCalled()
  })
})
