import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getBuildMetadata: vi.fn(),
  getEnvironmentSnapshot: vi.fn(),
}))

vi.mock('@nzila/os-core/health', () => ({
  getBuildMetadata: mocks.getBuildMetadata,
}))

vi.mock('@/lib/runtime/environment', () => ({
  getEnvironmentSnapshot: mocks.getEnvironmentSnapshot,
}))

const originalEnv = {
  ueDemoProfile: process.env.UE_DEMO_PROFILE,
  nextPublicUeDemoProfile: process.env.NEXT_PUBLIC_UE_DEMO_PROFILE,
}

function requestWithHost(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/version', {
    headers,
  })
}

describe('GET /api/version', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.UE_DEMO_PROFILE
    delete process.env.NEXT_PUBLIC_UE_DEMO_PROFILE
    mocks.getBuildMetadata.mockReturnValue({
      app: 'union-eyes',
      appVersion: '1.2.3',
      environment: 'staging',
      commitSha: 'abc123',
      buildTime: '2025-01-01T00:00:00.000Z',
    })
    mocks.getEnvironmentSnapshot.mockReturnValue({
      environment: 'demo',
      nzilaMode: 'demo',
      deploymentType: 'cupe4373-demo',
      featureProfile: 'cupe4373',
      isPilotRuntime: true,
      isProduction: false,
    })
  })

  afterEach(() => {
    process.env.UE_DEMO_PROFILE = originalEnv.ueDemoProfile
    process.env.NEXT_PUBLIC_UE_DEMO_PROFILE = originalEnv.nextPublicUeDemoProfile
  })

  it('classifies demo hosts and prefers x-forwarded-host', async () => {
    process.env.UE_DEMO_PROFILE = 'cupe4373'
    const { GET } = await import('./route')

    const response = await GET(
      requestWithHost({
        host: 'app.unioneyes.app',
        'x-forwarded-host': 'demo.unioneyes.app',
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.surfaceEnvironment).toBe('demo')
    expect(body.requestHost).toBe('demo.unioneyes.app')
    expect(body.demoProfile).toBe('cupe4373')
  })

  it('classifies staging hosts', async () => {
    const { GET } = await import('./route')
    const response = await GET(requestWithHost({ host: 'staging-app.unioneyes.app' }))
    const body = await response.json()

    expect(body.surfaceEnvironment).toBe('staging')
  })

  it('classifies production hosts', async () => {
    const { GET } = await import('./route')
    const response = await GET(requestWithHost({ host: 'app.unioneyes.app' }))
    const body = await response.json()

    expect(body.surfaceEnvironment).toBe('production')
  })

  it('returns unknown for unmatched hosts and nulls when headers/env are absent', async () => {
    const { GET } = await import('./route')
    const response = await GET(requestWithHost({}))
    const body = await response.json()

    expect(body.surfaceEnvironment).toBe('unknown')
    expect(body.requestHost).toBeNull()
    expect(body.demoProfile).toBeNull()
  })
})
