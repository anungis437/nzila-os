import { describe, expect, it, vi } from 'vitest'

vi.mock('@nzila/os-core/health', () => ({
  getBuildMetadata: vi.fn(() => ({
    app: 'veridian-admin',
    gitSha: 'test-sha',
    buildTime: 'test-time',
    appVersion: '1.0.0',
  })),
}))

describe('GET /api/version', () => {
  it('returns build metadata', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.app).toBe('veridian-admin')
    expect(body).toHaveProperty('gitSha')
    expect(body).toHaveProperty('buildTime')
    expect(body).toHaveProperty('appVersion')
  })
})
