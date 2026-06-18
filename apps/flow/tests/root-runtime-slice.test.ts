import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetRequestConfig,
  mockCreateAppBoot,
  mockBootstrapFlowControlLayer,
} = vi.hoisted(() => ({
  mockGetRequestConfig: vi.fn((cb: unknown) => cb),
  mockCreateAppBoot: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
  mockBootstrapFlowControlLayer: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next-intl/server', () => ({
  getRequestConfig: mockGetRequestConfig,
}))

vi.mock('@nzila/os-core/telemetry', () => ({
  createAppBoot: mockCreateAppBoot,
}))

vi.mock('@/lib/control/bootstrap', () => ({
  bootstrapFlowControlLayer: mockBootstrapFlowControlLayer,
}))

describe('root runtime slices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'test')
  })

  it('i18n config returns default locale on invalid request locale', async () => {
    const configFactory = (await import('@/i18n')).default
    const result = await configFactory({ requestLocale: Promise.resolve('invalid') })

    expect(result.locale).toBe('en-CA')
    expect(result.messages).toBeTruthy()
  })

  it('instrumentation register runs boot and node runtime bootstrap', async () => {
    process.env.NEXT_RUNTIME = 'nodejs'
    const { register } = await import('@/instrumentation')

    await register()

    expect(mockCreateAppBoot).toHaveBeenCalledWith('flow')
    expect(mockBootstrapFlowControlLayer).toHaveBeenCalledTimes(1)
  })

  it('instrumentation register skips bootstrap outside node runtime', async () => {
    process.env.NEXT_RUNTIME = 'edge'
    const { register } = await import('@/instrumentation')

    await register()

    expect(mockBootstrapFlowControlLayer).not.toHaveBeenCalled()
  })
})
