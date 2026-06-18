import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('GET /api/version', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    delete process.env.npm_package_version
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.GITHUB_SHA
    delete process.env.BUILD_TIME
    delete process.env.ARTIFACT_ID
  })

  it('returns build metadata with version', async () => {
    process.env.npm_package_version = '1.0.0'
    process.env.VERCEL_GIT_COMMIT_SHA = 'test-sha'
    process.env.BUILD_TIME = '2024-01-01T00:00:00Z'
    process.env.ARTIFACT_ID = 'test-artifact'

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.app).toBe('zonga')
    expect(body.appVersion).toBe('1.0.0')
    expect(body.gitSha).toBe('test-sha')
    expect(body.buildTime).toBe('2024-01-01T00:00:00Z')
    expect(body.artifactId).toBe('test-artifact')
  })

  it('includes fallback values when env vars missing', async () => {
    delete process.env.npm_package_version
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.GITHUB_SHA
    delete process.env.BUILD_TIME
    delete process.env.ARTIFACT_ID

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.appVersion).toBe('0.0.0')
    expect(body.gitSha).toBe('local')
    expect(body.buildTime).toBe('unknown')
    expect(body.artifactId).toBe('unknown')
  })

  it('includes timestamp', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body).toHaveProperty('timestamp')
    expect(typeof body.timestamp).toBe('string')
  })
})
