import { beforeEach, describe, expect, it, vi } from 'vitest'

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

function requestWithHost(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/version', {
    headers,
  })
}

describe('GET /api/version (operational package)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getBuildMetadata.mockReturnValue({
      app: 'union-eyes',
      appVersion: '1.2.3',
      environment: 'staging',
      commitSha: 'abc123',
      buildTime: '2025-01-01T00:00:00.000Z',
    })
    mocks.getEnvironmentSnapshot.mockReturnValue({
      environment: 'staging',
      nzilaMode: 'staging',
      deploymentType: 'staging',
      featureProfile: 'internal',
      isPilotRuntime: false,
      isProduction: false,
    })
  })

  it('prefers x-forwarded-host over host', async () => {
    const { GET } = await import('./route')

    const response = await GET(
      requestWithHost({
        host: 'app.unioneyes.app',
        'x-forwarded-host': 'staging-app.unioneyes.app',
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.surfaceEnvironment).toBe('staging')
    expect(body.requestHost).toBe('staging-app.unioneyes.app')
  })

  it('reports null demoProfile — operational package refuses demo env vars', async () => {
    const { GET } = await import('./route')
    const response = await GET(requestWithHost({ host: 'app.unioneyes.app' }))
    const body = await response.json()

    expect(body.demoProfile).toBeNull()
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

  it('returns unknown for unmatched hosts and null host when headers absent', async () => {
    const { GET } = await import('./route')
    const response = await GET(requestWithHost({}))
    const body = await response.json()

    expect(body.surfaceEnvironment).toBe('unknown')
    expect(body.requestHost).toBeNull()
    expect(body.demoProfile).toBeNull()
  })
})
