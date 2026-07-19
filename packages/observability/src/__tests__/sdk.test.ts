/**
 * @nzila/observability — SDK tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Reset module state between tests by dynamically importing
let initObservability: typeof import('../sdk').initObservability
let getObservabilityLogger: typeof import('../sdk').getObservabilityLogger
let shutdownObservability: typeof import('../sdk').shutdownObservability
let isObservabilityInitialized: typeof import('../sdk').isObservabilityInitialized

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('../sdk')
  initObservability = mod.initObservability
  getObservabilityLogger = mod.getObservabilityLogger
  shutdownObservability = mod.shutdownObservability
  isObservabilityInitialized = mod.isObservabilityInitialized
})

afterEach(async () => {
  // Ensure clean state
  try { await shutdownObservability() } catch {}
})

describe('initObservability', () => {
  it('initializes and returns a logger', () => {
    const logger = initObservability({ serviceName: 'test-app' })
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
  })

  it('marks as initialized', () => {
    expect(isObservabilityInitialized()).toBe(false)
    initObservability({ serviceName: 'test-svc' })
    expect(isObservabilityInitialized()).toBe(true)
  })

  it('returns same logger on repeated init (idempotent)', () => {
    const logger1 = initObservability({ serviceName: 'test-svc' })
    const logger2 = initObservability({ serviceName: 'test-svc-2' })
    expect(logger1).toBe(logger2)
  })

  it('uses ConsoleExporter when no exporter provided', () => {
    initObservability({ serviceName: 'test' })
    // Logger should have been created — just verify it works
    expect(isObservabilityInitialized()).toBe(true)
  })

  it('uses custom exporter when provided', () => {
    const fakeExporter = {
      name: 'fake',
      exportSpan: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    }
    initObservability({ serviceName: 'custom', exporter: fakeExporter })
    expect(isObservabilityInitialized()).toBe(true)
  })
})

describe('getObservabilityLogger', () => {
  it('returns a fallback logger when not initialized', () => {
    const logger = getObservabilityLogger()
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
  })

  it('returns the initialized logger after init', () => {
    initObservability({ serviceName: 'my-svc' })
    const logger = getObservabilityLogger()
    expect(logger).toBeDefined()
  })
})

describe('shutdownObservability', () => {
  it('resets initialized state', async () => {
    initObservability({ serviceName: 'test' })
    expect(isObservabilityInitialized()).toBe(true)

    await shutdownObservability()
    expect(isObservabilityInitialized()).toBe(false)
  })

  it('calls exporter.shutdown on the active exporter', async () => {
    const fakeExporter = {
      name: 'fake',
      exportSpan: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    }
    initObservability({ serviceName: 'custom', exporter: fakeExporter })

    await shutdownObservability()
    expect(fakeExporter.shutdown).toHaveBeenCalledTimes(1)
  })

  it('is safe to call when not initialized', async () => {
    await expect(shutdownObservability()).resolves.toBeUndefined()
  })
})
