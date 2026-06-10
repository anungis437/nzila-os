import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

describe('GET /api/version', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers VERCEL_GIT_COMMIT_SHA when present', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'vercel-sha')
    vi.stubEnv('GITHUB_SHA', 'github-sha')
    vi.stubEnv('BUILD_TIME', '2026-01-01T00:00:00.000Z')
    vi.stubEnv('ARTIFACT_ID', 'artifact-123')
    vi.stubEnv('npm_package_version', '1.2.3')

    const response = await GET()
    const body = await response.json()

    expect(body.app).toBe('mobility')
    expect(body.gitSha).toBe('vercel-sha')
    expect(body.buildTime).toBe('2026-01-01T00:00:00.000Z')
    expect(body.artifactId).toBe('artifact-123')
    expect(body.appVersion).toBe('1.2.3')
    expect(Number.isNaN(new Date(body.timestamp).getTime())).toBe(false)
  })

  it('falls back to defaults when env vars are missing', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.GITHUB_SHA
    delete process.env.BUILD_TIME
    delete process.env.ARTIFACT_ID
    delete process.env.npm_package_version

    const response = await GET()
    const body = await response.json()

    expect(body.gitSha).toBe('local')
    expect(body.buildTime).toBe('unknown')
    expect(body.artifactId).toBe('unknown')
    expect(body.appVersion).toBe('0.0.0')
  })
})
