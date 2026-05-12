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
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Initialized for test-app'),
      )

      // Second call should be no-op
      await initOtel({ appName: 'test-app' })
      expect(mockStart).toHaveBeenCalledTimes(1) // still 1

      consoleSpy.mockRestore()
    })

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
      await expect(
        withSpan('error-span', {}, async () => {
          throw new Error('boom')
        }),
      ).rejects.toThrow('boom')

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
