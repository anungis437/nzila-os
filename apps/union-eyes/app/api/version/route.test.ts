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

// The topology (environment, host, deployment type, image digests) is disclosed only to a caller that presents the deployment-probe
// credential (DEF-0B1-VERSION-UNAUTH-TOPOLOGY). These cases are the probe's view; the anonymous view is asserted separately below.
const PROBE_TOKEN = 'probe-token-value-1234567890'

function requestWithHost(headers: Record<string, string>, authorization: string | null = `Bearer ${PROBE_TOKEN}`): Request {
  return new Request('http://localhost/api/version', {
    headers: authorization ? { ...headers, authorization } : headers,
  })
}

describe('GET /api/version (operational package)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.UE_CANDIDATE_PROBE_TOKEN = PROBE_TOKEN
    mocks.getBuildMetadata.mockReturnValue({
      app: 'union-eyes',
      appVersion: '1.2.3',
      environment: 'staging',
      gitSha: 'abc123',
      buildTimestamp: '2025-01-01T00:00:00.000Z',
      releaseId: 'release-1',
      artifactId: 'artifact-1',
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

  it('reports the image digests configured on the candidate revision', async () => {
    process.env.UE_FRONTEND_IMAGE_DIGEST = 'sha256:frontend'
    process.env.UE_BACKEND_IMAGE_DIGEST = 'sha256:backend'
    const { GET } = await import('./route')
    const response = await GET(requestWithHost({ host: 'staging-app.unioneyes.app' }))
    const body = await response.json()

    expect(body.frontendImageDigest).toBe('sha256:frontend')
    expect(body.backendImageDigest).toBe('sha256:backend')
    delete process.env.UE_FRONTEND_IMAGE_DIGEST
    delete process.env.UE_BACKEND_IMAGE_DIGEST
  })

  describe('anonymous callers', () => {
    const TOPOLOGY = ['surfaceEnvironment', 'requestHost', 'demoProfile', 'frontendImageDigest', 'backendImageDigest', 'runtimeEnvironment', 'deploymentType', 'featureProfile', 'configuredEnvironment']

    it('receive only the build identity, whatever host they claim', async () => {
      const { GET } = await import('./route')
      for (const headers of [{ host: 'staging-app.unioneyes.app' }, { host: 'app.unioneyes.app', 'x-forwarded-host': 'staging-app.unioneyes.app' }, {}]) {
        const response = await GET(requestWithHost(headers, null))
        const body = await response.json()
        expect(response.status).toBe(200)
        expect(Object.keys(body).sort()).toEqual(['app', 'appVersion', 'artifactId', 'buildTimestamp', 'gitSha', 'releaseId'])
        for (const key of TOPOLOGY) expect(body, key).not.toHaveProperty(key)
        expect(response.headers.get('cache-control')).toBe('no-store')
      }
    })

    it('are not upgraded by a wrong, malformed or unconfigured credential', async () => {
      const { GET } = await import('./route')
      for (const authorization of ['Bearer wrong-token', 'Basic abc', 'Bearer ', PROBE_TOKEN]) {
        const body = await (await GET(requestWithHost({ host: 'staging-app.unioneyes.app' }, authorization))).json()
        expect(body, authorization).not.toHaveProperty('surfaceEnvironment')
      }
      delete process.env.UE_CANDIDATE_PROBE_TOKEN
      const unconfigured = await (await GET(requestWithHost({ host: 'staging-app.unioneyes.app' }))).json()
      expect(unconfigured).not.toHaveProperty('surfaceEnvironment')
    })
  })
})
