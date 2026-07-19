import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('GET /api/version', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns app version info with env variables', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.app).toBe('cora')
    expect(body).toHaveProperty('gitSha')
    expect(body).toHaveProperty('buildTime')
    expect(body).toHaveProperty('artifactId')
    expect(body).toHaveProperty('appVersion')
  })

  it('includes timestamp', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.timestamp).toBeDefined()
    expect(() => new Date(body.timestamp)).not.toThrow()
  })

  it('uses fallbacks for missing env vars', async () => {
    const originalVersion = process.env.npm_package_version

    // Clear env vars to test fallbacks
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.GITHUB_SHA
    delete process.env.BUILD_TIME
    delete process.env.ARTIFACT_ID
    delete process.env.npm_package_version

    try {
      const { GET } = await import('./route')
      const response = await GET()
      const body = await response.json()

      expect(body.gitSha).toBe('local')
      expect(body.buildTime).toBe('unknown')
      expect(body.artifactId).toBe('unknown')
      expect(body.appVersion).toBe('0.0.0')
    } finally {
      if (originalVersion === undefined) {
        delete process.env.npm_package_version
      } else {
        process.env.npm_package_version = originalVersion
      }
    }
  })
})
