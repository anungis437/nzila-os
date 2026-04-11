import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAppBoot } from '../telemetry/boot'

// Mock dynamic imports used inside boot()
const mockInitOtel = vi.fn()
const mockInitMetrics = vi.fn()
const mockValidateEnv = vi.fn()
const mockAssertBootInvariants = vi.fn()

vi.mock('../telemetry/otel', () => ({
  initOtel: (...args: unknown[]) => mockInitOtel(...args),
}))

vi.mock('../telemetry/metrics', () => ({
  initMetrics: (...args: unknown[]) => mockInitMetrics(...args),
}))

vi.mock('../config/env', () => ({
  validateEnv: (...args: unknown[]) => mockValidateEnv(...args),
}))

vi.mock('../boot-assert', () => ({
  assertBootInvariants: (...args: unknown[]) => mockAssertBootInvariants(...args),
}))

describe('createAppBoot', () => {
  const origEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_RUNTIME = 'nodejs'
    delete process.env.NEXT_PHASE
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    process.env = { ...origEnv }
  })

  it('returns a function', () => {
    const boot = createAppBoot('console')
    expect(typeof boot).toBe('function')
  })

  it('runs full boot sequence for a standard app', async () => {
    await createAppBoot('console')()

    expect(mockInitOtel).toHaveBeenCalledWith({ appName: 'console' })
    expect(mockInitMetrics).toHaveBeenCalledWith('console')
    expect(mockValidateEnv).toHaveBeenCalledWith('console')
    expect(mockAssertBootInvariants).toHaveBeenCalled()
  })

  it('skips when NEXT_RUNTIME is not nodejs', async () => {
    process.env.NEXT_RUNTIME = 'edge'
    await createAppBoot('console')()

    expect(mockInitOtel).not.toHaveBeenCalled()
    expect(mockInitMetrics).not.toHaveBeenCalled()
  })

  it('skips during production build phase', async () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    await createAppBoot('console')()

    expect(mockInitOtel).not.toHaveBeenCalled()
    expect(mockInitMetrics).not.toHaveBeenCalled()
  })

  it('respects skipMetrics option', async () => {
    await createAppBoot('web', { skipMetrics: true })()

    expect(mockInitOtel).toHaveBeenCalled()
    expect(mockInitMetrics).not.toHaveBeenCalled()
  })

  it('respects skipEnvValidation option', async () => {
    await createAppBoot('web', { skipEnvValidation: true })()

    expect(mockValidateEnv).not.toHaveBeenCalled()
  })

  it('respects skipBootAssert option', async () => {
    await createAppBoot('web', { skipBootAssert: true })()

    expect(mockAssertBootInvariants).not.toHaveBeenCalled()
  })

  it('degrades gracefully when initOtel throws', async () => {
    mockInitOtel.mockRejectedValue(new Error('OTel unavailable'))

    await expect(createAppBoot('console')()).resolves.toBeUndefined()
    expect(mockInitMetrics).toHaveBeenCalled()
  })

  it('degrades gracefully when initMetrics throws', async () => {
    mockInitMetrics.mockImplementation(() => {
      throw new Error('Metrics fail')
    })

    await expect(createAppBoot('console')()).resolves.toBeUndefined()
  })

  it('degrades gracefully when validateEnv throws', async () => {
    mockValidateEnv.mockImplementation(() => {
      throw new Error('Invalid env')
    })

    await expect(createAppBoot('console')()).resolves.toBeUndefined()
  })

  it('degrades gracefully when assertBootInvariants throws in non-production', async () => {
    mockAssertBootInvariants.mockImplementation(() => {
      throw new Error('Boot check failed')
    })
    process.env.NODE_ENV = 'development'

    await expect(createAppBoot('console')()).resolves.toBeUndefined()
  })

  it('throws in production when assertBootInvariants fails', async () => {
    mockAssertBootInvariants.mockImplementation(() => {
      throw new Error('Boot check failed')
    })
    process.env.NODE_ENV = 'production'

    await expect(createAppBoot('console')()).rejects.toThrow('Boot invariants failed')
  })

  it('passes correct app name to all subsystems', async () => {
    await createAppBoot('trade')()

    expect(mockInitOtel).toHaveBeenCalledWith({ appName: 'trade' })
    expect(mockInitMetrics).toHaveBeenCalledWith('trade')
    expect(mockValidateEnv).toHaveBeenCalledWith('trade')
  })

  it('works with combined skip options', async () => {
    await createAppBoot('web', {
      skipMetrics: true,
      skipBootAssert: true,
      skipEnvValidation: true,
    })()

    expect(mockInitOtel).toHaveBeenCalled()
    expect(mockInitMetrics).not.toHaveBeenCalled()
    expect(mockValidateEnv).not.toHaveBeenCalled()
    expect(mockAssertBootInvariants).not.toHaveBeenCalled()
  })
})
