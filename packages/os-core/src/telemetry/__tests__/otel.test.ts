/**
 * Tests for telemetry/otel.ts — OpenTelemetry Bootstrap
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('otel', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  async function loadModule() {
    return import('../../telemetry/otel') as Promise<typeof import('../../telemetry/otel')>
  }

  it('redacts callback/SAS queries, credentials and exception URLs without mutating completed spans', async () => {
    const { redactSpanForExport } = await loadModule()
    const context = { traceId: '1'.repeat(32), spanId: '2'.repeat(16), traceFlags: 1 }
    const attributes = Object.freeze({
      'http.url': 'https://synthetic-user:synthetic-password@staging.example.invalid/api/auth/callback?code=synthetic-code#synthetic-fragment',
      'http.target': '/api/auth/callback?code=synthetic-code',
      'url.full': 'https://account.blob.core.windows.net/test?sig=synthetic-signature',
      'url.query': 'code=synthetic-code',
      'URL.FULL': 'HTTPS://synthetic-user:synthetic-password@staging.example.invalid/callback?code=synthetic-code',
      'http.request.header.authorization': 'Bearer synthetic-bearer',
      'http.request.header.cookie': 'synthetic-cookie',
      'db.connection_string': 'synthetic-connection',
      'http.route': '/api/auth/callback/[provider]',
      'http.response.status_code': 200,
      'gen_ai.usage.input_tokens': 12,
      correlationId: 'keep-correlation',
    })
    const span = Object.freeze({
      name: 'GET /api/auth/callback?code=synthetic-code', attributes,
      events: [{ name: 'exception', time: [0, 0], attributes: { 'exception.message': 'GET /api/auth/callback?code=synthetic-code failed at https://staging.example.invalid/callback?code=synthetic-code' } }],
      links: [{ context, attributes: { 'url.full': 'https://staging.example.invalid/?token=synthetic-code' } }],
      status: { code: 2, message: 'failed at https://staging.example.invalid/callback?code=synthetic-code Bearer synthetic-bearer' },
      spanContext() { return context },
    })
    const actual = redactSpanForExport(span)
    expect(actual.attributes).toMatchObject({
      'http.url': 'https://staging.example.invalid/api/auth/callback',
      'http.target': '/api/auth/callback',
      'url.full': 'https://account.blob.core.windows.net/test',
      'url.query': '[REDACTED]',
      'URL.FULL': 'https://staging.example.invalid/callback',
      'http.request.header.authorization': '[REDACTED]',
      'http.request.header.cookie': '[REDACTED]',
      'db.connection_string': '[REDACTED]',
      'http.route': '/api/auth/callback/[provider]',
      'http.response.status_code': 200, 'gen_ai.usage.input_tokens': 12, correlationId: 'keep-correlation',
    })
    expect(actual.name).toBe('GET /api/auth/callback')
    expect(actual.spanContext()).toBe(context)
    expect(JSON.stringify([actual.attributes, actual.events, actual.links, actual.status])).not.toMatch(/synthetic-(?:code|signature|password|bearer|cookie|connection|fragment)/)
    expect(span.attributes).toBe(attributes)
    expect(span.attributes['http.target']).toContain('synthetic-code')
    expect(span.events[0].attributes['exception.message']).toContain('synthetic-code')
  })

  it('redacts SQL statements and driver bind values while retaining diagnostic identity', async () => {
    const { redactSpanForExport } = await loadModule()
    const privateValue = 'SYNTHETIC_PRIVATE_CASE_NARRATIVE'
    const failure = `Failed query: INSERT INTO claims VALUES ($1)\nparams: ${privateValue}`
    const context = { traceId: '5'.repeat(32), spanId: '6'.repeat(16), traceFlags: 1 }
    const span = {
      name: 'POST /api/cases',
      attributes: { 'db.statement': `SELECT '${privateValue}'`, 'db.query.text': `SELECT '${privateValue}'`,
        'db.query.parameter.description': privateValue, 'db.query.parameter_count': 1, 'db.operation.name': 'INSERT', correlationId: 'keep-correlation' },
      events: [{ attributes: { 'exception.type': 'DrizzleQueryError', 'exception.message': failure, 'exception.stacktrace': 'Error: ' + failure } }],
      links: [], status: { code: 2, message: failure }, spanContext: () => context,
    }
    const actual = redactSpanForExport(span)
    expect(JSON.stringify([actual.attributes, actual.events, actual.status])).not.toContain(privateValue)
    expect(actual.attributes).toMatchObject({ 'db.statement': '[REDACTED]', 'db.query.text': '[REDACTED]',
      'db.query.parameter.description': '[REDACTED]', 'db.query.parameter_count': 1, 'db.operation.name': 'INSERT', correlationId: 'keep-correlation' })
    expect(actual.events[0].attributes?.['exception.type']).toBe('DrizzleQueryError')
    expect(actual.spanContext()).toBe(context)
    expect(span.events[0].attributes['exception.message']).toContain(privateValue)
  })

  it('keeps long and malformed URL attributes bounded and fails closed on unparseable URLs', async () => {
    const { redactSpanForExport } = await loadModule()
    const span = { name: 'test', attributes: { 'http.url': 'https://[invalid?code=synthetic-code', 'http.target': '/'.repeat(100_000) + '?token=synthetic-code' }, events: [], links: [], status: { code: 1 }, spanContext: () => ({}) }
    const actual = redactSpanForExport(span)
    expect(actual.attributes['http.url']).toBe('[REDACTED]')
    expect(actual.attributes['http.target']).toBe('/'.repeat(100_000))
  })

  it.each(['grpc', 'http/json'])('redacts before the %s exporter serializes and preserves its lifecycle', async protocol => {
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = protocol
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL
    let configured: {
      export: (spans: unknown[], callback: (result: unknown) => void) => void
      shutdown: () => Promise<void>
      forceFlush: () => Promise<void>
    } | undefined
    const delivered = vi.fn()
    const shutdown = vi.fn().mockResolvedValue(undefined)
    const forceFlush = vi.fn().mockResolvedValue(undefined)
    class Exporter {
      export(spans: unknown[], callback: (result: unknown) => void) { delivered(spans); callback({ code: 0 }) }
      shutdown = shutdown
      forceFlush = forceFlush
    }
    vi.doMock('@opentelemetry/sdk-node', () => ({ NodeSDK: class {
      constructor(options: { traceExporter: typeof configured }) { configured = options.traceExporter }
      start() {}
      async shutdown() {}
    } }))
    vi.doMock('@opentelemetry/exporter-trace-otlp-grpc', () => ({ OTLPTraceExporter: Exporter }))
    vi.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({ OTLPTraceExporter: Exporter }))
    vi.doMock('@opentelemetry/auto-instrumentations-node', () => ({ getNodeAutoInstrumentations: () => [] }))
    vi.doMock('@opentelemetry/resources', () => ({ resourceFromAttributes: (attrs: unknown) => attrs }))
    vi.doMock('@opentelemetry/semantic-conventions', () => ({ ATTR_SERVICE_NAME: 'service.name', ATTR_SERVICE_VERSION: 'service.version' }))
    const { initOtel } = await loadModule()
    await initOtel({ appName: 'union-eyes' })
    expect(configured).toBeDefined()
    const context = { traceId: '3'.repeat(32), spanId: '4'.repeat(16), traceFlags: 1 }
    const span = { name: 'GET', attributes: { 'http.target': '/callback?code=synthetic-code', 'db.statement': 'SELECT synthetic-private-value' }, events: [{ attributes: { 'exception.message': 'Failed query: SELECT $1\nparams: synthetic-private-value' } }], links: [], status: { code: 1 }, spanContext: () => context }
    const callback = vi.fn()
    configured!.export([span], callback)
    const exported = delivered.mock.calls[0][0][0] as typeof span
    expect(exported.attributes['http.target']).toBe('/callback')
    expect(exported.attributes['db.statement']).toBe('[REDACTED]')
    expect(exported.events[0].attributes['exception.message']).not.toContain('synthetic-private-value')
    expect(exported.spanContext()).toBe(context)
    expect(span.attributes['http.target']).toContain('synthetic-code')
    expect(callback).toHaveBeenCalledWith({ code: 0 })
    await configured!.forceFlush()
    await configured!.shutdown()
    expect(forceFlush).toHaveBeenCalledOnce()
    expect(shutdown).toHaveBeenCalledOnce()
  })

  describe('initOtel', () => {
    it('initializes once and skips on second call', async () => {
      const mockStart = vi.fn()
      const mockShutdown = vi.fn().mockResolvedValue(undefined)

      vi.doMock('@opentelemetry/sdk-node', () => ({
        NodeSDK: class {
          start = mockStart
          shutdown = mockShutdown
        },
      }))
      vi.doMock('@opentelemetry/auto-instrumentations-node', () => ({
        getNodeAutoInstrumentations: () => [],
      }))
      vi.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
        OTLPTraceExporter: class {},
      }))
      vi.doMock('@opentelemetry/resources', () => ({
        resourceFromAttributes: (attrs: Record<string, unknown>) => ({ attributes: attrs }),
      }))
      vi.doMock('@opentelemetry/semantic-conventions', () => ({
        ATTR_SERVICE_NAME: 'service.name',
        ATTR_SERVICE_VERSION: 'service.version',
      }))

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { initOtel } = await loadModule()
      await initOtel({ appName: 'test-app' })

      expect(mockStart).toHaveBeenCalledTimes(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Initialized for test-app'))

      // Second call should be no-op
      await initOtel({ appName: 'test-app' })
      expect(mockStart).toHaveBeenCalledTimes(1) // still 1

      consoleSpy.mockRestore()
    })

    it.each([
      ['grpc', 'http://otel.service.k8se-apps:4317/', 'http://otel.service.k8se-apps:4317'],
      ['http/json', 'http://collector:4318/', 'http://collector:4318/v1/traces'],
      [
        'http/json',
        `http://collector:4318/${'/'.repeat(100_000)}x`,
        `http://collector:4318/${'/'.repeat(100_000)}x/v1/traces`,
      ],
    ])(
      'sends %s spans to its matching collector transport',
      async (protocol, endpoint, expectedUrl) => {
        process.env.OTEL_EXPORTER_OTLP_PROTOCOL = protocol
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT = endpoint
        delete process.env.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL
        delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
        const grpc = vi.fn(),
          http = vi.fn(),
          start = vi.fn()
        vi.doMock('@opentelemetry/sdk-node', () => ({
          NodeSDK: class {
            start = start
            shutdown = vi.fn()
          },
        }))
        vi.doMock('@opentelemetry/auto-instrumentations-node', () => ({
          getNodeAutoInstrumentations: () => [],
        }))
        vi.doMock('@opentelemetry/exporter-trace-otlp-grpc', () => ({
          OTLPTraceExporter: class {
            constructor(opts: unknown) {
              grpc(opts)
            }
          },
        }))
        vi.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
          OTLPTraceExporter: class {
            constructor(opts: unknown) {
              http(opts)
            }
          },
        }))
        vi.doMock('@opentelemetry/resources', () => ({
          resourceFromAttributes: (attrs: unknown) => attrs,
        }))
        vi.doMock('@opentelemetry/semantic-conventions', () => ({
          ATTR_SERVICE_NAME: 'service.name',
          ATTR_SERVICE_VERSION: 'service.version',
        }))
        const { initOtel } = await loadModule()
        await initOtel({ appName: 'union-eyes' })
        expect(protocol === 'grpc' ? grpc : http).toHaveBeenCalledWith({ url: expectedUrl })
        expect(protocol === 'grpc' ? http : grpc).not.toHaveBeenCalled()
        expect(start).toHaveBeenCalledOnce()
      },
    )

    it('falls back gracefully when OTel packages are missing', async () => {
      vi.doMock('@opentelemetry/sdk-node', () => {
        throw new Error('MODULE_NOT_FOUND')
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { initOtel } = await loadModule()
      await initOtel({ appName: 'test-app' })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize OpenTelemetry'),
        expect.anything(),
      )

      consoleSpy.mockRestore()
    })

    it('uses OTEL_EXPORTER_OTLP_ENDPOINT env var when no endpoint provided', async () => {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://collector:4318'

      const mockStart = vi.fn()
      vi.doMock('@opentelemetry/sdk-node', () => ({
        NodeSDK: class {
          start = mockStart
          shutdown = vi.fn()
        },
      }))
      vi.doMock('@opentelemetry/auto-instrumentations-node', () => ({
        getNodeAutoInstrumentations: () => [],
      }))
      vi.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
        OTLPTraceExporter: class {
          constructor(public opts: { url: string }) {}
        },
      }))
      vi.doMock('@opentelemetry/resources', () => ({
        resourceFromAttributes: (attrs: Record<string, unknown>) => ({ attributes: attrs }),
      }))
      vi.doMock('@opentelemetry/semantic-conventions', () => ({
        ATTR_SERVICE_NAME: 'service.name',
        ATTR_SERVICE_VERSION: 'service.version',
      }))

      vi.spyOn(console, 'log').mockImplementation(() => {})

      const { initOtel } = await loadModule()
      await initOtel({ appName: 'test-app' })

      expect(mockStart).toHaveBeenCalledTimes(1)
    })
  })

  describe('withSpan', () => {
    it('runs the function within a span and returns its result', async () => {
      const mockEnd = vi.fn()
      const mockSetStatus = vi.fn()
      const mockSpan = { setStatus: mockSetStatus, end: mockEnd }

      vi.doMock('@opentelemetry/api', () => ({
        trace: {
          getTracer: () => ({
            startSpan: () => mockSpan,
          }),
          setSpan: (_ctx: unknown, _span: unknown) => ({}),
        },
        context: {
          active: () => ({}),
          with: (_ctx: unknown, fn: () => unknown) => fn(),
        },
        SpanStatusCode: { OK: 1, ERROR: 2 },
      }))

      const { withSpan } = await loadModule()
      const result = await withSpan('test-span', { key: 'value' }, async () => {
        return 42
      })

      expect(result).toBe(42)
      expect(mockSetStatus).toHaveBeenCalledWith({ code: 1 })
      expect(mockEnd).toHaveBeenCalled()
    })

    it('sets error status on span when function throws', async () => {
      const mockEnd = vi.fn()
      const mockSetStatus = vi.fn()
      const mockSpan = { setStatus: mockSetStatus, end: mockEnd }

      vi.doMock('@opentelemetry/api', () => ({
        trace: {
          getTracer: () => ({
            startSpan: () => mockSpan,
          }),
          setSpan: (_ctx: unknown, _span: unknown) => ({}),
        },
        context: {
          active: () => ({}),
          with: (_ctx: unknown, fn: () => unknown) => fn(),
        },
        SpanStatusCode: { OK: 1, ERROR: 2 },
      }))

      const { withSpan } = await loadModule()
      const work = vi.fn(async () => { throw new Error('boom') })
      await expect(withSpan('error-span', {}, work)).rejects.toThrow('boom')
      expect(work).toHaveBeenCalledOnce()

      expect(mockSetStatus).toHaveBeenCalledWith({ code: 2, message: 'boom' })
      expect(mockEnd).toHaveBeenCalled()
    })

    it('falls back to no-op when OTel API is unavailable', async () => {
      vi.doMock('@opentelemetry/api', () => {
        throw new Error('MODULE_NOT_FOUND')
      })

      const { withSpan } = await loadModule()
      const result = await withSpan('fallback-span', {}, async () => 'ok')
      expect(result).toBe('ok')
    })
  })
})
