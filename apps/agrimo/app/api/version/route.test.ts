import { afterEach, describe, expect, it } from 'vitest'

const original = {
  vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
  githubSha: process.env.GITHUB_SHA,
  buildTime: process.env.BUILD_TIME,
  artifactId: process.env.ARTIFACT_ID,
  npmPackageVersion: process.env.npm_package_version,
}

afterEach(() => {
  process.env.VERCEL_GIT_COMMIT_SHA = original.vercelGitCommitSha
  process.env.GITHUB_SHA = original.githubSha
  process.env.BUILD_TIME = original.buildTime
  process.env.ARTIFACT_ID = original.artifactId
  process.env.npm_package_version = original.npmPackageVersion
})

describe('GET /api/version', () => {
  it('returns environment-derived version metadata', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'vercel-sha'
    process.env.GITHUB_SHA = 'github-sha'
    process.env.BUILD_TIME = '2026-06-10T00:00:00.000Z'
    process.env.ARTIFACT_ID = 'artifact-1'
    process.env.npm_package_version = '9.9.9'

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.app).toBe('agrimo')
    expect(body.gitSha).toBe('vercel-sha')
    expect(body.buildTime).toBe('2026-06-10T00:00:00.000Z')
    expect(body.artifactId).toBe('artifact-1')
    expect(body.appVersion).toBe('9.9.9')
  })

  it('falls back to defaults when env vars are missing', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.GITHUB_SHA
    delete process.env.BUILD_TIME
    delete process.env.ARTIFACT_ID
    delete process.env.npm_package_version

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.gitSha).toBe('local')
    expect(body.buildTime).toBe('unknown')
    expect(body.artifactId).toBe('unknown')
    expect(body.appVersion).toBe('0.0.0')
  })
})
