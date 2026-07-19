import { describe, expect, it, vi } from 'vitest'

vi.mock('@nzila/os-core/health', () => ({
  normalizeHealthChecks: vi.fn((checks) => ({
    process: checks.process ? 'ok' : 'fail',
    syntheticDataStore: checks.syntheticDataStore ? 'ok' : 'fail',
  })),
  isReadyFromChecks: vi.fn((checks) => checks.process === 'ok'),
  getBuildMetadata: vi.fn(() => ({
    app: 'veridian-care',
    gitSha: 'test-sha',
    buildTime: 'test-time',
    appVersion: '1.0.0',
  })),
}))

describe('GET /api/ready', () => {
  it('returns ready when process check passes', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ready).toBe(true)
    expect(body.status).toBe('ready')
  })

  it('returns 503 when not ready', async () => {
    const { isReadyFromChecks } = await import('@nzila/os-core/health')
    vi.mocked(isReadyFromChecks).mockReturnValueOnce(false)

    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(503)
  })

  it('includes app metadata', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body).toHaveProperty('app')
    expect(body.app).toBe('veridian-care')
    expect(body.checks).toBeDefined()
  })
})
