import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = {
  vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
  githubSha: process.env.GITHUB_SHA,
  buildTime: process.env.BUILD_TIME,
  artifactId: process.env.ARTIFACT_ID,
  npmPackageVersion: process.env.npm_package_version,
}

describe('GET /api/version', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env.VERCEL_GIT_COMMIT_SHA = originalEnv.vercelGitCommitSha
    process.env.GITHUB_SHA = originalEnv.githubSha
    process.env.BUILD_TIME = originalEnv.buildTime
    process.env.ARTIFACT_ID = originalEnv.artifactId
    process.env.npm_package_version = originalEnv.npmPackageVersion
    vi.resetModules()
  })

  it('returns all version metadata when env is populated', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'abc123'
    process.env.BUILD_TIME = '2025-01-01T12:00:00Z'
    process.env.ARTIFACT_ID = 'web-v1.0.0-prod'
    process.env.npm_package_version = '1.0.0'

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.app).toBe('web')
    expect(body.gitSha).toBe('abc123')
    expect(body.buildTime).toBe('2025-01-01T12:00:00Z')
    expect(body.artifactId).toBe('web-v1.0.0-prod')
    expect(body.appVersion).toBe('1.0.0')
  })

  it('falls back to github sha when vercel sha absent', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA
    process.env.GITHUB_SHA = 'github789'

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.gitSha).toBe('github789')
  })

  it('uses local fallback when both shas absent', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.GITHUB_SHA

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.gitSha).toBe('local')
  })

  it('uses fallbacks when build metadata env vars absent', async () => {
    delete process.env.BUILD_TIME
    delete process.env.ARTIFACT_ID
    delete process.env.npm_package_version
    process.env.VERCEL_GIT_COMMIT_SHA = 'commit123'

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.buildTime).toBe('unknown')
    expect(body.artifactId).toBe('unknown')
    expect(body.appVersion).toBe('0.0.0')
  })

  it('includes timestamp', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.timestamp).toBeDefined()
    expect(typeof body.timestamp).toBe('string')
    expect(body.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})
