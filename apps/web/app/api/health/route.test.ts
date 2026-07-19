import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = {
  npmPackageVersion: process.env.npm_package_version,
  vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
  githubSha: process.env.GITHUB_SHA,
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env.npm_package_version = originalEnv.npmPackageVersion
    process.env.VERCEL_GIT_COMMIT_SHA = originalEnv.vercelGitCommitSha
    process.env.GITHUB_SHA = originalEnv.githubSha
    vi.resetModules()
  })

  it('returns static ok with env version', async () => {
    process.env.npm_package_version = '1.2.3'
    process.env.VERCEL_GIT_COMMIT_SHA = 'abc123def456'

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.service).toBe('web')
    expect(body.buildInfo.version).toBe('1.2.3')
    expect(body.buildInfo.commit).toBe('abc123def456')
    expect(body.checks.static).toBe(true)
  })

  it('falls back to github sha when vercel sha not set', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA
    process.env.GITHUB_SHA = 'github789xyz'
    process.env.npm_package_version = '2.0.0'

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.buildInfo.commit).toBe('github789xyz')
  })

  it('uses local fallback when both shas absent', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.GITHUB_SHA
    process.env.npm_package_version = '0.5.0'

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.buildInfo.commit).toBe('local')
    expect(body.buildInfo.version).toBe('0.5.0')
  })

  it('uses version fallback when npm_package_version absent', async () => {
    delete process.env.npm_package_version
    process.env.VERCEL_GIT_COMMIT_SHA = 'commit123'

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.buildInfo.version).toBe('0.0.0')
    expect(body.buildInfo.commit).toBe('commit123')
  })

  it('includes timestamp in response', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.timestamp).toBeDefined()
    expect(typeof body.timestamp).toBe('string')
    // Basic ISO 8601 check
    expect(body.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})
