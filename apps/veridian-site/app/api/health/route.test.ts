import { describe, expect, it, vi } from 'vitest'

vi.mock('@nzila/os-core/health', () => ({
  normalizeHealthChecks: vi.fn((checks) => ({ process: checks.process ? 'ok' : 'fail' })),
  healthStatusFromChecks: vi.fn((checks) => checks.process === 'ok' ? 'ok' : 'degraded'),
  getBuildMetadata: vi.fn(() => ({
    app: 'veridian-site',
    gitSha: 'test-sha',
    buildTime: 'test-time',
    appVersion: '1.0.0',
  })),
}))

describe('GET /api/health', () => {
  it('returns ok status when all checks pass', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.app).toBe('veridian-site')
    expect(body.checks).toBeDefined()
  })

  it('returns 503 when health check fails', async () => {
    const { healthStatusFromChecks } = await import('@nzila/os-core/health')
    vi.mocked(healthStatusFromChecks).mockReturnValueOnce('degraded')

    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(503)
  })

  it('includes build metadata', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body).toHaveProperty('app')
    expect(body).toHaveProperty('gitSha')
    expect(body).toHaveProperty('buildTime')
    expect(body).toHaveProperty('appVersion')
  })
})
